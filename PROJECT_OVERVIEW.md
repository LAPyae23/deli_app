# FoodDash — Project Overview

A multi-sided food delivery platform built for Yangon, with real operations, live maps, and data science that actually drives decisions.

---

## 1. Executive Summary

**FoodDash** is a full-stack food delivery system that connects four groups on one platform: hungry customers, restaurant kitchens, delivery riders, and platform operators.

- **What it is:** An end-to-end marketplace — browse, order, cook, dispatch, deliver, and analyze — in Myanmar Kyat, with Yangon townships as the service map.
- **Core business value:** Faster orders, fairer rider pay, smarter kitchens, and an admin view that sees the whole city instead of isolated spreadsheets.
- **Why it stands out:** It is not only a checkout app. It uses **machine learning and analytics on 10,000+ orders** so each portal gets a different kind of intelligence:
  - Customers get personal picks and weather-aware suggestions.
  - Restaurants see demand and prep bottlenecks.
  - Riders see where surge demand is forming.
  - Admins segment customers, forecast time, and run the network.

**In one sentence:** FoodDash turns food delivery from “place an order and wait” into a **data-informed city operation**.

---

## 2. Tech Stack & Architecture

Built as a modern TypeScript web app so one codebase can serve every role.

### Frontend & product

- **Next.js 15** (App Router) + **React 19** — four dashboards, shared APIs, fast page loads
- **TypeScript** — safer contracts between UI, APIs, and MongoDB models
- **Tailwind CSS** — consistent, role-colored UI (customer, restaurant, rider, admin)
- **Recharts** — live KPIs, volume, RFM, and ML charts
- **Framer Motion / Sonner** — smooth interactions and clear feedback

### Backend & data

- **Next.js Route Handlers** — REST APIs for auth, orders, menus, wallets, analytics
- **MongoDB + Mongoose** — orders, profiles, menus, messages, system config
- **bcrypt** — hashed passwords and role-based login (Customer, Restaurant, Rider, Admin)

### Maps & routing

- **Leaflet** (OpenStreetMap tiles) — restaurant location, rider idle map, live tracking, service zones
- **OSRM** — real road routes (not straight lines) from kitchen → rider → customer

### Intelligence layer

- **simple-statistics** — linear regression (R², MAE, RMSE)
- Custom **Apriori** and **RFM** pipelines on live order data
- Optional **AI chatbot** (OpenAI SDK) for menu help from real restaurant catalogs

### Architecture in plain language

- One app, four portals, one database.
- Dashboards talk to `/api/...` routes.
- Heavy reports use **MongoDB aggregations** so the server summarizes 10k+ orders instead of downloading them all into memory.

---

## 3. The Four Core Portals

### Customer Dashboard

*“Find food. Track it. Come back tomorrow.”*

- Discover restaurants near a saved Yangon address (distance, open / busy / closed)
- Menu, cart, promo codes, and checkout in Kyat
- **AI Picks** — weather, trending, and “because you ordered…” recommendations
- Live order tracking on a **Leaflet + OSRM** map
- Chat with rider and support
- Order history, reviews, reorder, streak rewards, and **Foodie Wrapped** (personal year-in-food stats)

### Restaurant Vendor Portal

*“Accept, cook, and know what to prep next.”*

- Incoming **order queue** (accept, prep time, ready for rider)
- Menu and stock management
- Store status: Open / Busy / Closed
- Revenue KPIs after commission (not inflated by tax + delivery)
- **Kitchen insights** — bottlenecks, weather-based demand hints (e.g. rainy-day noodle prep)
- Message the assigned rider when the bag is ready

### Rider Fleet Dashboard

*“Know where to go, who to pick up, and what you earned.”*

- Go Online / Offline; dispatch only when available
- Accept jobs, navigate pickup → dropoff on a live route map
- Message **customer and restaurant**
- Weekly earnings, trips, distance, tips
- **COD wallet** with remittance (KBZPay / WavePay) and auto-block at high outstanding debt
- **Predictive demand heatmap** — which township is short of riders and paying surge

### Super Admin Terminal

*“Run the marketplace like a city control room.”*

- Platform GMV, orders, cancellations, prep time, rider supply
- Vendor / rider **approval queue**
- Service zones on the map
- System config (commission rates, delivery radius, surge)
- Inbox and user lookup
- **Advanced Analytics** — top restaurants, status mix
- **ML suite** — RFM segments, Apriori baskets, regression, churn metrics
- Executive PDF + full CSV dataset export

---

## 4. Advanced Data Science & ML Features

These are not slide-only models. They run on **real order documents** in MongoDB and show up as charts operators can act on.

### RFM Customer Segmentation

- Scores every customer on **Recency** (days since last order), **Frequency** (how often), and **Monetary** (how much they spend).
- Groups people into clear actions:
  - **Top VIP** — protect with care and promos
  - **Sleeping Beauty** — win-back (they used to order, then went quiet)
  - **New / Normal** — grow into regulars
- Admins can **grant a one-time promo** to a segment instead of spraying discounts to everyone.

### Apriori Market Basket Analysis

- Finds dishes that are **bought together** (e.g. Mohinga + Milk Tea).
- Reports **support**, **confidence**, and **lift** so kitchens and the app know which combos are real patterns, not coincidence.
- Powers “complete your bag” style recommendations and restaurant prep hints.

### Linear Regression (prep + travel time)

- Learns: **duration ≈ slope × distance + intercept**.
- Judges and operators see **R²** (how well distance explains time), plus **MAE** and **RMSE** (how many minutes we are typically off).
- Helps set honest ETAs and understand when traffic or kitchen delay breaks the pattern.

### Predictive Demand Heatmap

- Aggregates **live orders by township** vs **online riders**.
- When orders exceed riders (about **2×**), the zone lights up and **surge** can raise rider pay.
- Riders see a simple message: *“High demand in Insein — head there for 2.8×.”*

### Extra intelligence (same data spine)

- **Churn view** with hold-out accuracy, F1, and a confusion matrix — not a fake “100%” score
- Customer **streaks**, weather-aware picks, restaurant **rainy-day forecasts**
- Admin **order-volume** and GMV charts that exclude cancelled/rejected orders so numbers stay honest

---

## 5. System Performance & Scalability

FoodDash was pressure-tested as a **10,000+ order** system, not a toy catalog.

**Problem we solved:** Loading every order into the app (`find()` with no limit) would freeze dashboards and time out APIs.

### How we scaled it

- **MongoDB Aggregation pipelines**
  - `$match` → `$group` → `$facet` for KPIs, heatmaps, RFM, restaurant stats, rider earnings
  - The database **counts and sums**; Node.js does not pull 10k full documents for a chart
- **Compound indexes** on `Order`, for example:
  - `{ restaurantId, status, createdAt }`
  - `{ customerId, status, createdAt }`
  - `{ riderId, status, createdAt }`
  - `{ status, unassigned, createdAt }` for rider dispatch
- **Lean, capped lists** for UI (`limit` 50–100) so queues stay snappy
- **Short TTL cache** on heavy admin/rider reads (stats, heatmap, restaurants, ML)
- **Honest money math**
  - GMV ignores cancelled/rejected
  - Restaurant net = food subtotal − commission (not the customer’s tax-inclusive total)

**What this means in the demo:** Overview, kitchen, rider radar, and ML charts stay usable while the catalog still holds a city-scale order history.

---

## Closing line for judges

FoodDash is a **complete four-sided delivery product** with maps that follow real roads, operations that match a real kitchen-and-rider day, and **ML that is wired to the same 10k-order database** the dashboards use — so every insight can become a promo, a surge zone, or a faster ticket out of the kitchen.
