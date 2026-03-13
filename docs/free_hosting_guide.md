# Free Hosting Options for TrainFlow Dashboard

You are correct: **Vercel is not suitable for this project.** Vercel uses Serverless Functions which are designed to be short-lived (seconds). Your dashboard relies on **Server-Sent Events (SSE)**, which require a persistent, long-running connection that Vercel will eventually time out or "cold start."

## Recommended Free Tiers for SSE

| Provider | Best For | Persistent SSE? | Pros | Cons |
| :--- | :--- | :--- | :--- | :--- |
| **Oracle Cloud** | **Production** | ✅ **Yes** | 4 OCPUs, 24GB RAM (ARM VM). Truly always-on. | Requires credit card for verification. Hard to get capacity. |
| **Render** | **Small Tests** | ⚠️ Limited | Very easy to deploy via Git. | **15-min idle timeout** drops connections. Cold starts. |
| **Railway** | **Ease of Use** | ✅ Yes | Great UI, handles background tasks. | Limits based on $5 credit (not truly "always free"). |
| **Fly.io** | **Low Latency** | ✅ Yes | Close to users, no "sleep" mode. | Credit card required. 60s idle timeout (needs heartbeats). |

## Why Oracle Cloud is the Winner
Oracle's **Always Free ARM Compute** is the most powerful free resource in the industry. It gives you a full Virtual Machine (VM) where you can install Node.js and MongoDB directly.
- **No Idle Timeouts:** Your SSE connections will stay open as long as the server is up.
- **Resource Heavy:** 24GB of RAM is more than enough to handle your current 500Hz data stream and FFT processing.

## The Vercel Question

**Is Vercel possible?**
- **For the Dashboard UI (Frontend):** ✅ **Yes, and it's recommended.** Vercel is excellent at hosting your build files and providing a fast, global experience.
- **For the Real-time Engine (Backend):** ❌ **No.** 
  - Vercel functions have a **5-minute hard limit** on free plans. Your SSE stream would die and need to reconnect every few minutes.
  - Vercel is **stateless**. The backend logic that tracks connected station sensors and simulations would be "reset" every time the serverless instance scales down.

## Recommended: The Hybrid Approach

The most professional and cost-effective way to host this for free is to split the app:

| Layer | Component | Where to Host (Free) |
| :--- | :--- | :--- |
| **Frontend** | React Build Files | **Vercel** or **Netlify** |
| **Backend** | Node.js / SSE / MQTT | **Oracle Cloud VM** or **Render** |
| **Database** | Metadata / Events | **MongoDB Atlas** (512MB, Never expires) |
| **Relational DB** | PostgreSQL | **Render Free Postgres** (1GB, **Expires in 30 days**) |
| **MQ Broker** | Real-time Messaging | **HiveMQ Cloud** |

### ⚠️ Important: Render Postgres Warning
While Render provides a free PostgreSQL database, it has two major "gotchas":
1.  **30-Day Expiration:** The free database expires and is **completely deleted** after 30 days. You must upgrade to a paid plan ($7/mo) to keep your data.
2.  **1GB Storage:** At your 500Hz data rate (1,000 records/sec), a 1GB database would fill up in **less than 6 hours** if you log every single point.
1.  **Vercel** gives you a premium URL (e.g., `trainflow.vercel.app`) for your users.
2.  **Oracle/Render** provides the "always-on" heartbeat needed for the 500Hz sensor data logic.
3.  The frontend simply connects to your backend URL (e.g., `https://my-backend.oracle.com/api/sse`) to get the data.

## How to Deploy (High Level)
1.  **Frontend:** Connect your GitHub repo to Vercel. Set the `VITE_API_URL` environment variable to your backend's URL.
2.  **Backend:** Deploy the `server/` folder to an **Oracle Cloud VM** or **Render**.
3.  **Database:** Use **MongoDB Atlas** (Free Tier) and provide the connection string to your backend.
4.  **MQTT:** Continue using **HiveMQ Cloud**.

> [!IMPORTANT]
> **The Render "Sleep" Workaround**
> If you choose **Render**, your server will "sleep" after 15 minutes of inactivity. To prevent this:
> 1.  Create a free account at [UptimeRobot](https://uptimerobot.com/).
> 2.  Set up a "HTTPS Monitor" for your backend's `/api/health` endpoint.
> 3.  Set the interval to **5 minutes**.
> This trick keeps your Render instance "awake" 24/7 so the real-time graphs are always ready.

### Can it handle millisecond data?
**Yes.** Because Render is a "real" Node.js server (not a serverless function), it can maintain a persistent SSE connection.
- Your code **batches** 10 samples (2ms each) and sends them every **20ms**.
- Render easily handles this frequency as long as the connection remains open.
- The 512MB RAM of the free tier is sufficient for 1–5 concurrent users viewing the real-time graphs.
