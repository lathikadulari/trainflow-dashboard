# TrainFlow Dashboard Hosting Requirements

This document outlines the hardware and software requirements for hosting the TrainFlow Dashboard and its backend services.

## Minimum Requirements (Standard Deployment)
These specifications are suitable for small-scale deployments (e.g., monitoring a single station like Makumbura).

*   **CPU:** 2 vCPU (2.0 GHz+) - FFT processing and real-time SSE streaming are primarily CPU-bound.
*   **RAM:** 4 GB - Node.js backend and the React frontend (client-side rendering) benefit from sufficient memory.
*   **Storage:** 20 GB SSD - Primary storage for the OS, Node.js applications, and MongoDB data logs.
*   **Network:** 10 Mbps+ Stable Connection - Crucial for real-time MQTT data reception and SSE broadcasting.

## Software Requirements

*   **Operating System:** Linux (Ubuntu 22.04 LTS recommended) or Windows Server.
*   **Runtime:** Node.js 18.x or 20.x (LTS).
*   **Database:** MongoDB v6.0+.
*   **Message Broker:** HiveMQ Cloud or a local MQTT broker (e.g., Mosquitto).
*   **Reverse Proxy:** Nginx or Apache (to handle SSL/TLS and port forwarding).

## Critical Performance Considerations

> [!IMPORTANT]
> **Real-time Data Throughput**
> The system processes 500 samples/sec and broadcasts 50 SSE events/sec. For every connected dashboard client, the backend maintains an open SSE connection.
> *   Increase **RAM** if supporting multiple concurrent users.
> *   The client machine (viewing the dashboard) needs a decent GPU or modern browser to render the 12+ real-time charts smoothly.

> [!TIP]
> **Production Scaling**
> For high-traffic production environments, consider offloading the MongoDB instance to a managed service (e.g., MongoDB Atlas) and using a cloud-managed MQTT broker.
