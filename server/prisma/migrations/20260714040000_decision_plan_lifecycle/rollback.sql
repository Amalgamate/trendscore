-- Manual data-preserving rollback. New columns/tables remain so immutable
-- submission and revision history cannot be lost during an app rollback.
-- PostgreSQL enum values are likewise retained because rows may reference them.

