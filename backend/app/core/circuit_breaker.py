"""
Circuit Breaker Pattern - Netflix Hystrix Style
Prevents cascade failures by failing fast when external services are down.
"""

import asyncio
import time
from dataclasses import dataclass, field
from enum import Enum
from functools import wraps
from typing import Any, Callable, Optional


class CircuitState(Enum):
    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing fast
    HALF_OPEN = "half_open"  # Testing recovery


@dataclass
class CircuitBreaker:
    """
    Netflix Hystrix-style circuit breaker.

    States:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Too many failures, requests fail immediately
    - HALF_OPEN: Testing if service recovered

    Usage:
        @circuit_breaker(name="verification_api", failure_threshold=5)
        async def call_verification_api(data):
            return await external_api.verify(data)
    """

    name: str
    failure_threshold: int = 5  # Failures before opening
    recovery_timeout: float = 30.0  # Seconds before trying again
    half_open_max_calls: int = 3  # Test calls in half-open state

    # Internal state
    state: CircuitState = field(default=CircuitState.CLOSED)
    failure_count: int = field(default=0)
    success_count: int = field(default=0)
    last_failure_time: float = field(default=0.0)
    half_open_calls: int = field(default=0)

    def _should_allow_request(self) -> bool:
        """Check if request should be allowed based on current state"""
        if self.state == CircuitState.CLOSED:
            return True

        if self.state == CircuitState.OPEN:
            # Check if recovery timeout has passed
            if time.time() - self.last_failure_time >= self.recovery_timeout:
                self._transition_to_half_open()
                return True
            return False

        if self.state == CircuitState.HALF_OPEN:
            # Allow limited calls in half-open state
            if self.half_open_calls < self.half_open_max_calls:
                return True
            return False

        return False

    def _transition_to_half_open(self):
        """Transition to half-open state"""
        self.state = CircuitState.HALF_OPEN
        self.half_open_calls = 0
        print(f"🔄 Circuit '{self.name}' transitioning to HALF_OPEN")

    def _record_success(self):
        """Record successful call"""
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            self.half_open_calls += 1

            # If enough successes, close the circuit
            if self.success_count >= self.half_open_max_calls:
                self.state = CircuitState.CLOSED
                self.failure_count = 0
                self.success_count = 0
                print(f"✅ Circuit '{self.name}' CLOSED (recovered)")
        else:
            # Reset failure count on success in closed state
            self.failure_count = 0

    def _record_failure(self):
        """Record failed call"""
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.state == CircuitState.HALF_OPEN:
            # Failed during recovery test, reopen
            self.state = CircuitState.OPEN
            self.success_count = 0
            print(f"🔴 Circuit '{self.name}' reopened (recovery failed)")

        elif self.state == CircuitState.CLOSED:
            if self.failure_count >= self.failure_threshold:
                self.state = CircuitState.OPEN
                print(f"🔴 Circuit '{self.name}' OPEN (threshold reached)")


class CircuitBreakerError(Exception):
    """Raised when circuit breaker is open"""

    pass


# Registry of circuit breakers
_circuit_breakers: dict[str, CircuitBreaker] = {}


def get_circuit_breaker(name: str, **kwargs) -> CircuitBreaker:
    """Get or create a circuit breaker by name"""
    if name not in _circuit_breakers:
        _circuit_breakers[name] = CircuitBreaker(name=name, **kwargs)
    return _circuit_breakers[name]


def circuit_breaker(
    name: str,
    failure_threshold: int = 5,
    recovery_timeout: float = 30.0,
    fallback: Optional[Callable] = None,
):
    """
    Decorator to wrap async functions with circuit breaker pattern.

    Args:
        name: Unique identifier for this circuit
        failure_threshold: Number of failures before opening
        recovery_timeout: Seconds to wait before trying again
        fallback: Optional fallback function if circuit is open

    Usage:
        @circuit_breaker("email_service", failure_threshold=3, fallback=lambda: {"status": "queued"})
        async def send_email(to: str, subject: str):
            return await email_api.send(to, subject)
    """

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cb = get_circuit_breaker(
                name,
                failure_threshold=failure_threshold,
                recovery_timeout=recovery_timeout,
            )

            if not cb._should_allow_request():
                if fallback:
                    return (
                        await fallback(*args, **kwargs)
                        if asyncio.iscoroutinefunction(fallback)
                        else fallback(*args, **kwargs)
                    )
                raise CircuitBreakerError(
                    f"Circuit '{name}' is OPEN. Service unavailable."
                )

            try:
                result = await func(*args, **kwargs)
                cb._record_success()
                return result
            except Exception as e:
                cb._record_failure()
                raise

        return wrapper

    return decorator


def with_retry(
    max_attempts: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 10.0,
    exponential_base: float = 2.0,
):
    """
    Decorator for exponential backoff retry.

    Usage:
        @with_retry(max_attempts=3)
        async def flaky_operation():
            return await external_api.call()
    """

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            delay = initial_delay
            last_exception = None

            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_attempts - 1:
                        await asyncio.sleep(min(delay, max_delay))
                        delay *= exponential_base

            raise last_exception

        return wrapper

    return decorator


# Combined pattern: Retry + Circuit Breaker
def resilient(
    name: str,
    max_attempts: int = 3,
    failure_threshold: int = 5,
    fallback: Optional[Callable] = None,
):
    """
    Combined retry + circuit breaker for maximum resilience.

    Usage:
        @resilient("verification_api", max_attempts=2, failure_threshold=5)
        async def verify_identity(document):
            return await verification_service.check(document)
    """

    def decorator(func: Callable):
        # Apply retry first, then circuit breaker
        retried = with_retry(max_attempts=max_attempts)(func)
        protected = circuit_breaker(
            name=name, failure_threshold=failure_threshold, fallback=fallback
        )(retried)
        return protected

    return decorator


# Health check for all circuits
def get_circuit_health() -> dict:
    """Get health status of all circuit breakers"""
    return {
        name: {
            "state": cb.state.value,
            "failures": cb.failure_count,
            "last_failure": cb.last_failure_time,
        }
        for name, cb in _circuit_breakers.items()
    }
