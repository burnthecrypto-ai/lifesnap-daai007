# LifeSnap by DAAI007

Core line: **Talk it out. We put it in order.**  
Motto: **Everything sorted. Everything in order.**

## Product stack

- **DAAI007** = parent company / engine
- **LifeSnap** = front-end app
- **LifeSnap Brain** = backend intelligence layer
- **Nebius Token Factory** = planned OpenAI-compatible AI backend
- **Your Body Clear / Legacy Vault / Life Order Set / LifeSnap Pro** = verticals

## V1 boundaries

LifeSnap is an organisational tool. It does not provide medical, legal, financial, therapeutic, emergency, probate, executor, banking, diagnosis, treatment, or credential-storage services.

Do not store:
- raw passwords
- PINs
- private keys
- card numbers
- banking logins
- secret credentials

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Backend route

The backend skeleton is:

```text
api/lifesnap-brain.js
```

It is designed for a future serverless host. The Nebius key must stay server-side only.
