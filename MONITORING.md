# Roomivo — Monitoring & Alerting Runbook

This document covers production monitoring setup for the Roomivo platform.

---

## 1. Health Endpoint

The backend exposes a comprehensive health check:

```
GET /health
```

Response (healthy):
```json
{
  "status": "healthy",
  "timestamp": "2026-02-12T10:00:00Z",
  "version": "1.0.0",
  "circuits": { ... }
}
```

**Monitor this endpoint** with an uptime service (see below). Alert if:
- HTTP status ≠ 200
- Response time > 5 seconds
- `status` ≠ `"healthy"`

---

## 2. Sentry (Error & Performance Monitoring)

Sentry is already integrated. For production, configure these alert rules in the Sentry dashboard:

### Error Alerts
| Rule | Trigger | Action |
|---|---|---|
| High error rate | > 10 errors / 5 min | Email + Slack |
| Critical endpoint down | Any 5xx on `/api/v1/auth/*` | Immediate email |
| Unhandled exception | Any unhandled exception | Email |

### Performance Alerts
| Rule | Trigger | Action |
|---|---|---|
| Slow API | P95 response time > 3s | Email |
| High transaction volume | > 1000 txn / min | Email (potential attack) |

### Production Sample Rates
Update `main.py` environment config:
```python
traces_sample_rate=0.2    # 20% of requests (saves quota)
profiles_sample_rate=0.1  # 10% profiling
```

---

## 3. Uptime Monitoring

### Recommended: UptimeRobot (free tier — 50 monitors, 5-min intervals)

Set up these monitors:

| Monitor | URL | Interval | Alert |
|---|---|---|---|
| Backend Health | `https://api.roomivo.com/health` | 5 min | Email + webhook |
| Frontend | `https://roomivo.com` | 5 min | Email |
| API Auth | `https://api.roomivo.com/api/v1/auth/me` (expect 401) | 15 min | Email |

### Alternative: Better Uptime (better UI, free tier — 10 monitors)

---

## 4. Database Monitoring

### Connection Pool
The SQLAlchemy async engine is configured with `pool_pre_ping=True`. Monitor:
- Active connections vs. pool size
- Query durations (via Sentry performance)

### Backups
Automated via `scripts/backup_db.sh`:
```bash
# Add to crontab (daily at 3 AM)
0 3 * * * /path/to/scripts/backup_db.sh >> /var/log/roomivo-backup.log 2>&1
```

Verify backups:
```bash
# List recent backups
ls -lhS backups/rental_platform_*.sql.gz

# Test restore (on a test DB, never production!)
gunzip -c backups/rental_platform_LATEST.sql.gz | psql -U rental -d test_restore
```

---

## 5. Key Metrics to Track

| Metric | Source | Target |
|---|---|---|
| API response time (P95) | Sentry | < 500ms |
| Error rate | Sentry | < 0.5% |
| Uptime | UptimeRobot | > 99.5% |
| Active users (DAU) | Application logs / analytics | Growth trend |
| Registration rate | Auth endpoint logs | Track weekly |
| Verification completion | Verification router logs | > 80% |
| DB backup success | Backup script logs | 100% daily |

---

## 6. Incident Response Checklist

When an alert fires:

1. **Acknowledge** — Check Sentry for error details
2. **Assess severity**:
   - 🔴 **P0**: Site down, payments broken → Fix immediately
   - 🟠 **P1**: Feature broken, data issue → Fix within 4 hours
   - 🟡 **P2**: Degraded performance → Fix within 24 hours
3. **Investigate** — Check `/health`, Sentry traces, Railway logs
4. **Fix & Deploy** — Push fix, CI runs automatically
5. **Post-mortem** — Document what happened, add monitoring to prevent recurrence

---

## 7. Log Access

| Service | How to access logs |
|---|---|
| Backend (Railway) | `railway logs` CLI or Railway dashboard |
| Frontend (Vercel) | Vercel dashboard → Functions → Runtime Logs |
| Database | Railway dashboard → PostgreSQL → Logs |
| Sentry | sentry.io dashboard |

---

## Quick Setup Checklist

- [ ] Create UptimeRobot account and add 3 monitors
- [ ] Configure Sentry alert rules (error + performance)
- [ ] Set Sentry sample rates to production values
- [ ] Add backup cron job on the server
- [ ] Test backup restore on staging
- [ ] Set up a #roomivo-alerts Slack/Discord channel
- [ ] Connect Sentry + UptimeRobot notifications to the channel
