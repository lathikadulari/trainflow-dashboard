# Database Comparison: MongoDB vs. PostgreSQL

For a project like TrainFlow, the choice depends on whether you are just storing "events" (like a train pass) or the **raw sensor signal** (500Hz data points).

## Comparison at a Glance

| Feature | MongoDB | PostgreSQL + TimescaleDB |
| :--- | :--- | :--- |
| **Write Speed** | ⚠️ High, but can struggle with consistent high-volume logs. | ✅ **Best.** Designed to handle millions of points per second. |
| **Read Speed** | ✅ Fast for simple lookups. | ✅ **Best for Time-Series.** Specialized in range queries (e.g., "last 5 min"). |
| **Storage** | ⚠️ Can get "bloated" with JSON overhead. | ✅ **Optimized.** Uses columnar compression (up to 90% savings). |
| **Ease of Use** | ✅ **Very Easy.** Flexible JSON schema. | ⚠️ **Moderate.** Requires a defined schema (SQL). |

## Write Throughput Math (Can it handle 500Hz?)

**Short Answer: Yes, easily.**

*   **Your Load:** 500 samples/sec × 2 sensors = **1,000 records/sec**.
*   **Typical PostgreSQL Limit:** 10,000 – 50,000 records/sec.
*   **TimescaleDB Limit:** 100,000+ records/sec.

You are only using about **1% – 10%** of the total write capacity of a standard database instance. You can scale to **50+ sensors** on a single database before needing to upgrade hardware.

## 1. The Specific Case for TrainFlow (500Hz)
Your sensors generate **500 samples per second**.
- **Current App Setup:** You aren't actually saving this to the DB yet—it's streamed in-memory.
- **If you start logging raw data:** 
    - **MongoDB** will quickly grow to several gigabytes and might start slowing down your API because it has to manage complex index updates for every document.
    - **PostgreSQL (with TimescaleDB extension)** is the industry standard for this. It partitions the data by time, making it extremely fast to insert and query even with billions of records.

## 2. When to choose MongoDB (Current Choice)
Stick with MongoDB if:
1.  You only want to store **Users**, **Station Info**, and **Train detection events**.
2.  You want the fastest development speed.
3.  You don't need to analyze historical raw waveforms.

## 3. When to choose PostgreSQL
Switch to PostgreSQL if:
1.  You plan to **log every millisecond** of the sensor data for future research/AI training.
2.  You want to run complex analytics on historical data.
3.  You want a database that "scales" easily as you add 10+ stations.

> [!TIP]
> **Recommendation:** Since you are currently using MongoDB and it's working for your events/auth, **stick with it for now.** However, if you decide to build a "Waveform Archive" feature, you should move that specific data to **PostgreSQL + TimescaleDB**.
