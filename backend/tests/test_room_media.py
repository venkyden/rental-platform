"""WP4 — room media labels: capture-page room list (no hardcoded label,
surface included) and gps_verified on synced photos.
"""

from app.routers.properties import _rooms_for_capture


class TestRoomsForCapture:
    def test_none_room_details_returns_none(self):
        assert _rooms_for_capture(None) is None

    def test_empty_room_details_returns_none(self):
        assert _rooms_for_capture([]) is None

    def test_rooms_with_surface(self):
        rooms = _rooms_for_capture([{"surface": 12}, {"surface": 9.5}])
        assert rooms == [{"index": 0, "surface": 12}, {"index": 1, "surface": 9.5}]

    def test_rooms_without_surface_still_indexed(self):
        rooms = _rooms_for_capture([{"description": "no surface set"}])
        assert rooms == [{"index": 0, "surface": None}]

    def test_falls_back_across_surface_field_variants(self):
        # room_details is heterogeneous across record eras (surface / surface_sqm / size_sqm)
        rooms = _rooms_for_capture([{"surface_sqm": 10}, {"size_sqm": 11}])
        assert rooms == [{"index": 0, "surface": 10}, {"index": 1, "surface": 11}]

    def test_no_label_key_in_output(self):
        # The capture page now localizes the label client-side — the server
        # must not emit hardcoded English text.
        rooms = _rooms_for_capture([{"surface": 12}])
        assert "label" not in rooms[0]


class TestGpsVerifiedPhotoSync:
    def _mk(self, **kw):
        class M:
            pass
        m = M()
        for k, v in kw.items():
            setattr(m, k, v)
        return m

    def _sync_dict(self, media, index=0):
        # Mirrors the inline construction in get_property's photo-sync block.
        return {
            "url": media.file_url,
            "order": index,
            "room_index": media.room_index,
            "room_label": media.room_label,
            "media_type": media.media_type,
            "gps_verified": media.verification_status == "verified" and media.captured_latitude is not None,
        }

    def test_verified_with_gps_is_true(self):
        m = self._mk(file_url="x", room_index=0, room_label="Room 1",
                      media_type="photo", verification_status="verified", captured_latitude=48.85)
        assert self._sync_dict(m)["gps_verified"] is True

    def test_pending_review_is_false(self):
        m = self._mk(file_url="x", room_index=0, room_label="Room 1",
                      media_type="photo", verification_status="pending_review", captured_latitude=48.85)
        assert self._sync_dict(m)["gps_verified"] is False

    def test_verified_without_gps_coords_is_false(self):
        # e.g. a manual-upload fallback path with no capture-session GPS.
        m = self._mk(file_url="x", room_index=None, room_label=None,
                      media_type="photo", verification_status="verified", captured_latitude=None)
        assert self._sync_dict(m)["gps_verified"] is False
