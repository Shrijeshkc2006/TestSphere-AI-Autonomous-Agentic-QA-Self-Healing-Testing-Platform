"""
URL validation service with SSRF mitigations.

Rules enforced:
- Only http / https schemes allowed.
- Block cloud metadata endpoints (169.254.169.254, fd00::ec2, etc.).
- Block known private CIDR ranges unless allow_local=True.
- Block hostnames that resolve to private IPs (checked at validation time).
- Require explicit user opt-in (allow_local=True) for localhost / 127.x / ::1.
"""
import ipaddress
import re
import socket
from typing import Dict, Any
from urllib.parse import urlparse

import structlog

log = structlog.get_logger()

# ---------------------------------------------------------------------------
# Blocked ranges
# ---------------------------------------------------------------------------

_METADATA_ENDPOINTS = {
    "169.254.169.254",      # AWS / GCP / Azure IMDS
    "fd00::ec2",            # AWS IPv6
    "metadata.google.internal",
    "169.254.170.2",        # ECS task metadata
}

_PRIVATE_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("100.64.0.0/10"),   # CGNAT
    ipaddress.ip_network("fc00::/7"),         # ULA IPv6
    ipaddress.ip_network("fe80::/10"),        # link-local IPv6
]

_LOOPBACK_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
]


def _is_private_ip(addr: str) -> bool:
    try:
        ip = ipaddress.ip_address(addr)
        return any(ip in net for net in _PRIVATE_NETWORKS)
    except ValueError:
        return False


def _is_loopback_ip(addr: str) -> bool:
    try:
        ip = ipaddress.ip_address(addr)
        return ip.is_loopback
    except ValueError:
        return False


def _is_metadata_endpoint(host: str) -> bool:
    host_lower = host.lower()
    if host_lower in _METADATA_ENDPOINTS:
        return True
    # Also catch numeric variants like 169.254.169.254
    try:
        ip = ipaddress.ip_address(host_lower)
        if ip == ipaddress.ip_address("169.254.169.254"):
            return True
        if ip.is_link_local:
            return True
    except ValueError:
        pass
    return False


def _resolve_host(host: str) -> list[str]:
    """Resolve hostname to IP addresses. Returns [] on failure."""
    try:
        results = socket.getaddrinfo(host, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        return list({r[4][0] for r in results})
    except (socket.gaierror, OSError):
        return []


async def validate_url(url: str, allow_local: bool = False) -> Dict[str, Any]:
    """
    Validate a target URL for safety.

    Returns:
        {"valid": True} or {"valid": False, "reason": "<human-readable reason>"}
    """
    if not url:
        return {"valid": False, "reason": "URL is required"}

    # Scheme check
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return {"valid": False, "reason": "Only http and https URLs are allowed"}

    host = parsed.hostname
    if not host:
        return {"valid": False, "reason": "URL has no hostname"}

    # Metadata endpoint block — always, regardless of allow_local
    if _is_metadata_endpoint(host):
        log.warning("url_validator.metadata_blocked", host=host)
        return {"valid": False, "reason": "Target resolves to a cloud metadata endpoint (blocked for security)"}

    # Loopback check
    is_loopback_hostname = host in ("localhost", "127.0.0.1", "::1") or re.match(r"^127\.", host or "")
    if is_loopback_hostname and not allow_local:
        return {
            "valid": False,
            "reason": "Localhost URLs require a Local URL project type. Use 'Local URL' as the project type to test local applications."
        }

    # Private IP in URL directly
    if _is_private_ip(host) and not allow_local:
        return {"valid": False, "reason": "Private network addresses are not allowed as target URLs"}

    # DNS resolution check — catch SSRF via DNS rebinding
    if not is_loopback_hostname and "." in host:
        resolved = _resolve_host(host)
        if not resolved:
            # Could not resolve — allow it; the test runner will fail at runtime
            log.info("url_validator.unresolvable", host=host)
        else:
            for ip in resolved:
                if _is_metadata_endpoint(ip):
                    log.warning("url_validator.dns_metadata_blocked", host=host, resolved=ip)
                    return {"valid": False, "reason": f"Hostname '{host}' resolves to a blocked metadata address"}
                if _is_private_ip(ip) and not allow_local:
                    log.warning("url_validator.dns_private_blocked", host=host, resolved=ip)
                    return {"valid": False, "reason": f"Hostname '{host}' resolves to a private network address (blocked for security)"}

    return {"valid": True}
