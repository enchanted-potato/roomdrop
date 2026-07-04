# roomdrop
Upload a photo of your room, then drag in cushions, furniture, and wall art to redecorate it. Backgrounds are removed automatically so everything sits naturally in the space — design your room before you buy a thing.

Markdown

# Data Pipeline Architecture: SCD Type 2 with Late-Arriving Data Support

This document outlines the end-to-end design plan for building a robust, high-performance Slowly Changing Dimension (SCD) Type 2 data pipeline using **Apache Airflow** and **dbt (Data Build Tool)** over **Google BigQuery**. 

The architecture specifically solves for **late-arriving data** (out-of-chronological-order updates) while protecting BigQuery compute costs using an incremental **"Blast Radius" isolation technique**.

---

## 1. High-Level Architecture Overview

The pipeline uses a decoupled, multi-layered framework where each layer has a distinct responsibility:

[ Airflow ] ---> [ Raw Source Sink ] (Append-Only)|v[ dbt Staging Layer ] (Incremental Deduplication)|v[ dbt Intermediate Layer ] (Blast Radius / Master History Ledger)|v[ dbt Core Mart Layer ] (SCD Type 2 Timeline Reconstitution)
### The Two-Clock Principle
To handle late-arriving data flawlessly, the pipeline relies on two distinct timestamps:
1. **`source_updated_at` (Business Clock):** When the change actually occurred in the source system. This dictates the `valid_from` and `valid_to` boundaries.
2. **`elt_ingested_at` (System Clock):** When Airflow physically appended the data into BigQuery. This allows dbt to process micro-batches incrementally without scanning full histories.

---

## 2. Layer-by-Layer Implementation Plan

### Layer 1: Airflow & BigQuery Source Sink (Ingestion)
* **Strategy:** Append-Only.
* **Responsibility:** Airflow acts as a lightweight, efficient pipe. It pulls modified or new rows from source systems and appends them blindly into BigQuery. No deduplication or ordering happens here.
* **Metadata Required:** Every appended record must be stamped with `elt_ingested_at = current_timestamp()`.

### Layer 2: dbt Staging Layer (`stg_`)
* **Materialization:** `incremental` (Strategy: `merge`).
* **Responsibility:** Deduplicates the raw stream within the newly ingested batch to ensure there is only one record per unique entity ID per business timestamp (`source_updated_at`).
* **Performance Benefit:** Prevents downstream models from scanning massive, raw append-only tables.

```sql
{{
    config(
        materialized='incremental',
        unique_key=['borrower_id', 'source_updated_at'],
        incremental_strategy='merge',
        cluster_by=['borrower_id']
    )
}}

with raw_records as (
    select borrower_id, borrower_name, borrower_credit_score, source_updated_at, elt_ingested_at
    from {{ source('raw', 'borrowers') }}
    {% if is_incremental() %}
    where elt_ingested_at > (select max(elt_ingested_at) from {{ this }})
    {% endif %}
),
deduped_batch as (
    select *,
        row_number() over (
            partition by borrower_id, source_updated_at 
            order by elt_ingested_at desc
        ) as rn
    from raw_records
)
select * exclude(rn) from deduped_batch where rn = 1
Layer 3: dbt Intermediate Layer (int_)Materialization: incremental (Strategy: merge).Responsibility: Acts as a Master History Ledger for each independent entity. It identifies the "Blast Radius"—the specific list of entity IDs that had new or late data arrive today—and grabs their entire historical timeline from staging.Key Use Case: This is where you generate placeholder records (e.g., for late-arriving dimensions where a transaction arrives before the customer profile exists) to preserve downstream referential integrity.SQL{{
    config(
        materialized='incremental',
        unique_key=['borrower_id', 'source_updated_at'],
        incremental_strategy='merge',
        cluster_by=['borrower_id']
    )
}}

with new_or_updated_records as (
    select borrower_id from {{ ref('stg_borrowers') }}
    {% if is_incremental() %}
    where dbt_updated_at > (select max(dbt_updated_at) from {{ this }})
    {% endif %}
),
blast_radius_ids as (
    select distinct borrower_id from new_or_updated_records
)
select s.* from {{ ref('stg_borrowers') }} s
{% if is_incremental() %}
join blast_radius_ids b on s.borrower_id = b.borrower_id
{% endif %}
Layer 4: dbt Core Mart Layer (dim_ / fct_)Materialization: incremental (Strategy: merge).Responsibility: Reconstitutes the SCD Type 2 timelines (valid_from, valid_to, is_current) using analytic window functions (lead()).Handling Late Data: If a record arrives months late, the lead() function automatically inserts it into its correct chronological position, shortening the previous record's valid_to date and creating a seamless timeline.Scenario A: Single-Table SCD Type 2 Core MartSQL{{
    config(
        materialized='incremental',
        unique_key=['borrower_id', 'valid_from'],
        incremental_strategy='merge'
    )
}}

with intermediate_data as (
    select * from {{ ref('int_borrowers_history') }}
    {% if is_incremental() %}
    where borrower_id in (
        select distinct borrower_id from {{ ref('int_borrowers_history') }}
        where elt_ingested_at > (select max(elt_ingested_at) from {{ this }})
    )
    {% endif %}
),
recalculated_timeline as (
    select
        borrower_id, borrower_name, borrower_credit_score,
        source_updated_at as valid_from,
        lead(source_updated_at) over (partition by borrower_id order by source_updated_at asc) as next_valid_from,
        elt_ingested_at
    from intermediate_data
)
select
    borrower_id,
    md5(concat(cast(borrower_id as string), '_', cast(valid_from as string))) as borrower_sk,
    borrower_name, borrower_credit_score, valid_from,
    coalesce(next_valid_from, cast('9999-12-31' as timestamp)) as valid_to,
    case when next_valid_from is null then true else false end as is_current,
    current_timestamp() as dbt_updated_at
from recalculated_timeline
Scenario B: Multi-Table Joins in Core Mart (Timeline Cartesian Splitting)When joining multiple historical tables (e.g., borrowers and loans), we must generate a new row whenever either table changes. We accomplish this through Timeline Cartesian Splitting:Gather all unique event dates across all joined tables for the affected IDs.Build a unified chronological grid using lead().Perform point-in-time inequality joins (<= valid_from) to pull the correct descriptive attributes for that specific time window.3. Performance Summary & BigQuery OptimizationLayerMaterializationStrategy For Late DataBigQuery Cost Protection1. Raw SinkAppend-Only TableIngests rows out of order with a modern elt_ingested_at timestamp.0% scanning cost; straight append.2. StagingIncremental TableFilters raw data by elt_ingested_at > max(elt_ingested_at).Scans only the newly arrived micro-batch.3. IntermediateIncremental TableFinds modified entity IDs and extracts their localized histories.Eliminates full table scans; isolates the "Blast Radius".4. Core MartIncremental TableRuns lead() on isolated entity pools and executes an upsert MERGE.Rewrites and evaluates only records for modified entities.