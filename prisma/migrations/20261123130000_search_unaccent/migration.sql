-- Tìm kiếm không phân biệt dấu (mục 2.2 đặc tả Ngày 6).
-- Cần extension unaccent (có sẵn trong image postgres:16-alpine;
-- trên DB local, user hoa tạo được vì unaccent là trusted extension
-- từ PostgreSQL 13 trở lên).
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION vi_unaccent(text) RETURNS text AS $$
  SELECT lower(translate(unaccent('unaccent'::regdictionary, $1), 'đĐ', 'dd'))
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;
