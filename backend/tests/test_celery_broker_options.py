"""
The worker's idle polling of Redis is billed per command (Upstash pay-as-you-go).
kombu waits on BRPOP for `polling_interval` seconds per command; at the default
of 1 second an idle worker sent ~86,000 commands a day (2026-10-21).
"""

from app.workers.celery_app import celery_app


def test_idle_worker_polls_redis_at_most_twice_a_minute():
    options = celery_app.conf.broker_transport_options
    assert options["polling_interval"] >= 30


def test_socket_timeout_outlasts_the_blocking_wait():
    # A read timeout shorter than the BRPOP wait would fail every idle poll.
    options = celery_app.conf.broker_transport_options
    assert options["socket_timeout"] > options["polling_interval"]


def test_connecting_still_fails_fast():
    assert celery_app.conf.broker_transport_options["socket_connect_timeout"] <= 5
