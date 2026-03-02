"""
Mux Video API client for ProspectX Film Room.

All Mux interactions go through this module. The rest of the app
never imports mux_python directly.

Requires environment variables:
    MUX_TOKEN_ID      – Mux API access token ID
    MUX_TOKEN_SECRET  – Mux API access token secret
"""

import os
import logging
from typing import Optional

import mux_python
from mux_python.rest import ApiException

logger = logging.getLogger("prospectx.mux")

# ---------------------------------------------------------------------------
# Client initialization (lazy — created on first call)
# ---------------------------------------------------------------------------

_api_client: Optional[mux_python.ApiClient] = None


def _get_client() -> mux_python.ApiClient:
    """Return a configured Mux API client (singleton)."""
    global _api_client
    if _api_client is None:
        token_id = os.environ.get("MUX_TOKEN_ID", "")
        token_secret = os.environ.get("MUX_TOKEN_SECRET", "")
        if not token_id or not token_secret:
            raise RuntimeError(
                "MUX_TOKEN_ID and MUX_TOKEN_SECRET environment variables are required"
            )
        configuration = mux_python.Configuration()
        configuration.username = token_id
        configuration.password = token_secret
        _api_client = mux_python.ApiClient(configuration)
    return _api_client


# ---------------------------------------------------------------------------
# Direct Upload
# ---------------------------------------------------------------------------


def create_direct_upload(cors_origin: str = "*") -> dict:
    """Create a Mux direct upload URL.

    Returns:
        {
            "upload_url": str,   – authenticated URL for client PUT
            "upload_id": str,    – Mux upload ID
        }
    """
    client = _get_client()
    uploads_api = mux_python.DirectUploadsApi(client)

    asset_settings = mux_python.CreateAssetRequest(
        playback_policy=[mux_python.PlaybackPolicy.PUBLIC],
    )
    upload_request = mux_python.CreateUploadRequest(
        timeout=3600,
        new_asset_settings=asset_settings,
        cors_origin=cors_origin,
    )

    try:
        response = uploads_api.create_direct_upload(upload_request)
        return {
            "upload_url": response.data.url,
            "upload_id": response.data.id,
        }
    except ApiException as e:
        logger.error("Mux create_direct_upload failed: %s", e)
        raise


# ---------------------------------------------------------------------------
# Asset operations
# ---------------------------------------------------------------------------


def get_asset(asset_id: str) -> dict:
    """Get a Mux asset by ID.

    Returns:
        {
            "asset_id": str,
            "status": str,           – "preparing" | "ready" | "errored"
            "playback_id": str|None, – first public playback ID if available
            "duration": float|None,  – seconds
        }
    """
    client = _get_client()
    assets_api = mux_python.AssetsApi(client)

    try:
        response = assets_api.get_asset(asset_id)
        asset = response.data

        playback_id = None
        if asset.playback_ids and len(asset.playback_ids) > 0:
            playback_id = asset.playback_ids[0].id

        return {
            "asset_id": asset.id,
            "status": asset.status,
            "playback_id": playback_id,
            "duration": asset.duration,
        }
    except ApiException as e:
        logger.error("Mux get_asset(%s) failed: %s", asset_id, e)
        raise


def get_upload(upload_id: str) -> dict:
    """Get a Mux direct upload by ID.

    Returns:
        {
            "upload_id": str,
            "status": str,       – "waiting" | "asset_created" | "errored" | "cancelled"
            "asset_id": str|None,
        }
    """
    client = _get_client()
    uploads_api = mux_python.DirectUploadsApi(client)

    try:
        response = uploads_api.get_direct_upload(upload_id)
        upload = response.data
        return {
            "upload_id": upload.id,
            "status": upload.status,
            "asset_id": upload.asset_id,
        }
    except ApiException as e:
        logger.error("Mux get_upload(%s) failed: %s", upload_id, e)
        raise


def get_playback_url(playback_id: str) -> str:
    """Return the public HLS playback URL for a Mux playback ID."""
    return f"https://stream.mux.com/{playback_id}.m3u8"


def delete_asset(asset_id: str) -> bool:
    """Delete a Mux asset. Returns True on success."""
    client = _get_client()
    assets_api = mux_python.AssetsApi(client)

    try:
        assets_api.delete_asset(asset_id)
        logger.info("Mux asset %s deleted", asset_id)
        return True
    except ApiException as e:
        logger.error("Mux delete_asset(%s) failed: %s", asset_id, e)
        raise
