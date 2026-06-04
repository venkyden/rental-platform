.PHONY: test-canary test-integration test-unit test-stage

DB ?= postgresql+asyncpg://127.0.0.1:5432/roomivo_test

# Run only the system canary — fastest feedback on "is it broken?"
test-canary:
	cd backend && DATABASE_URL=$(DB) python -m pytest \
		tests_integration/test_system_canary.py -v --tb=short -m canary

# Run the full integration suite (real Postgres)
test-integration:
	cd backend && DATABASE_URL=$(DB) python -m pytest \
		tests_integration/ -v --tb=short

# Run the unit/mock tests (no DB needed)
test-unit:
	cd backend && python -m pytest \
		tests/test_config.py tests/test_auth.py tests/test_properties.py \
		tests/test_french_compliance.py tests/test_security_headers.py \
		-v --tb=short

# Spin up an isolated test DB via Docker, run migrations + canary, then tear down
test-stage:
	docker compose -f docker-compose.test.yml run --rm test-runner
	docker compose -f docker-compose.test.yml down -v
