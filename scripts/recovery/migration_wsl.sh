#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/mnt/e/iufl-auction-dashboard"
cd "$ROOT"

mkdir -p backup/sql backup/csv backup/reports backup/rollback

LOG_FILE="backup/reports/progress.log"
REPORT_FILE="backup/reports/migration_report.md"
SOURCE_COUNTS_FILE="backup/reports/source_counts.csv"
TARGET_COUNTS_FILE="backup/reports/target_counts.csv"
COUNT_DIFF_FILE="backup/reports/table_count_diff.csv"
INTEGRITY_FILE="backup/reports/integrity_checks.csv"
SMOKE_FILE="backup/reports/smoke_checks.csv"
PLAYER_SAMPLES_FILE="backup/reports/player_url_samples.csv"
TEAMROLE_SAMPLES_FILE="backup/reports/teamrole_url_samples.csv"

: > "$LOG_FILE"

phase_log() {
  local msg="$1"
  printf "[%s] %s\n" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$msg" | tee -a "$LOG_FILE"
}

safe_env_load() {
  set -a
  # shellcheck disable=SC1090
  source <(sed 's/\r$//' .env.local)
  set +a
}

conn_source() {
  printf 'host=%s port=%s user=%s dbname=%s sslmode=require' \
    "$SOURCE_DB_HOST" "$SOURCE_DB_PORT" "$SOURCE_DB_USER" "$SOURCE_DB_NAME"
}

conn_target() {
  printf 'host=%s port=%s user=%s dbname=%s sslmode=%s' \
    "$NEW_DB_HOST" "$NEW_DB_PORT" "$NEW_DB_USER" "$NEW_DB_NAME" "$NEW_DB_SSLMODE"
}

safe_psql_source() {
  PGPASSWORD="$SOURCE_DB_PASSWORD" psql "$(conn_source)" "$@"
}

safe_psql_target() {
  PGPASSWORD="$NEW_DB_PASSWORD" psql "$(conn_target)" "$@"
}

safe_pg_dump_source() {
  PGPASSWORD="$SOURCE_DB_PASSWORD" pg_dump \
    -h "$SOURCE_DB_HOST" -p "$SOURCE_DB_PORT" -U "$SOURCE_DB_USER" -d "$SOURCE_DB_NAME" "$@"
}

completed_steps=()
failed_steps=()

record_ok() {
  completed_steps+=("$1")
  phase_log "OK: $1"
}

record_fail() {
  failed_steps+=("$1")
  phase_log "FAIL: $1"
}

write_report() {
  {
    echo "# Migration Report"
    echo
    echo "- Generated at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo
    echo "## Completed Steps"
    if ((${#completed_steps[@]} == 0)); then
      echo "- None"
    else
      for s in "${completed_steps[@]}"; do
        echo "- $s"
      done
    fi
    echo
    echo "## Failed Steps"
    if ((${#failed_steps[@]} == 0)); then
      echo "- None"
    else
      for s in "${failed_steps[@]}"; do
        echo "- $s"
      done
    fi
    echo
    echo "## Table Count Diff"
    if [[ -f "$COUNT_DIFF_FILE" ]]; then
      echo
      echo '```csv'
      cat "$COUNT_DIFF_FILE"
      echo '```'
    else
      echo "- Not available"
    fi
    echo
    echo "## Integrity Check Results"
    if [[ -f "$INTEGRITY_FILE" ]]; then
      echo
      echo '```csv'
      cat "$INTEGRITY_FILE"
      echo '```'
    else
      echo "- Not available"
    fi
    echo
    echo "## URL Rewrite Counts"
    echo "- Player URLs updated: ${player_updated_count:-0}"
    echo "- TeamRoleProfile URLs updated: ${teamrole_updated_count:-0}"
    echo "- TeamRoleProfile URLs skipped (icons not available): ${teamrole_skipped_count:-0}"
    echo "- Remaining Player supabase/storage URLs: ${remaining_player_supabase_count:-0}"
    echo "- Remaining TeamRoleProfile supabase/storage URLs: ${remaining_teamrole_supabase_count:-0}"
    echo
    echo "## Rollback Artifacts"
    echo "- backup/rollback/player_imageurl_backup.csv"
    echo "- backup/rollback/teamrole_imageurl_backup.csv"
    echo
    echo "## Phase G - S3 Refactor Map"
    if [[ -f backup/reports/s3_refactor_map.md ]]; then
      cat backup/reports/s3_refactor_map.md
    else
      echo "- Not generated"
    fi
  } > "$REPORT_FILE"
}

safe_env_load

phase_log "Phase A: Preflight"
if command -v psql >/dev/null 2>&1 && command -v pg_dump >/dev/null 2>&1; then
  record_ok "A1 Tooling check (psql/pg_dump available)"
else
  record_fail "A1 Tooling check (psql/pg_dump missing)"
  write_report
  exit 1
fi

if safe_psql_source -v ON_ERROR_STOP=1 -c "select now();" >/dev/null; then
  record_ok "A1 Source connectivity via direct DB host"
else
  record_fail "A1 Source connectivity via direct DB host"
  write_report
  exit 1
fi

if safe_psql_target -v ON_ERROR_STOP=1 -c "select now();" >/dev/null; then
  record_ok "A1 Target connectivity via NEW_DB_*"
else
  record_fail "A1 Target connectivity via NEW_DB_*"
  write_report
  exit 1
fi

mkdir -p backup/sql backup/csv backup/reports backup/rollback
record_ok "A2 Artifact folders ensured"

phase_log "Phase B: Extract from restricted source"
if safe_pg_dump_source \
  --schema=public --no-owner --no-acl -F p \
  -f ./backup/sql/full_public_dump.sql; then
  record_ok "B3 Full public schema dump"
else
  record_fail "B3 Full public schema dump"
fi

if safe_pg_dump_source \
  --no-owner --no-acl -F p \
  -t public."AuctionSession" \
  -t public."Team" \
  -t public."Player" \
  -t public."Transaction" \
  -t public."AuctionActionHistory" \
  -t public."TeamRoleProfile" \
  -t public."ImportImageIngestionRun" \
  -t public."ImportImageIngestionJob" \
  -f ./backup/sql/critical_tables_dump.sql; then
  record_ok "B4 Critical tables fallback dump"
else
  record_fail "B4 Critical tables fallback dump"
fi

tables=(
  AuctionSession
  Team
  Player
  Transaction
  AuctionActionHistory
  TeamRoleProfile
  ImportImageIngestionRun
  ImportImageIngestionJob
)

csv_ok=true
for t in "${tables[@]}"; do
  if ! safe_psql_source -v ON_ERROR_STOP=1 -c "\\copy public.\"$t\" to './backup/csv/${t}.csv' csv header" >/dev/null; then
    csv_ok=false
    record_fail "B5 CSV export for $t"
  fi
done
if [[ "$csv_ok" == true ]]; then
  record_ok "B5 CSV safety exports for critical tables"
fi

safe_psql_source -v ON_ERROR_STOP=1 -c "\\copy (
SELECT 'AuctionSession' AS table_name, COUNT(*)::bigint AS row_count FROM public.\"AuctionSession\"
UNION ALL SELECT 'Team', COUNT(*)::bigint FROM public.\"Team\"
UNION ALL SELECT 'Player', COUNT(*)::bigint FROM public.\"Player\"
UNION ALL SELECT 'Transaction', COUNT(*)::bigint FROM public.\"Transaction\"
UNION ALL SELECT 'AuctionActionHistory', COUNT(*)::bigint FROM public.\"AuctionActionHistory\"
UNION ALL SELECT 'TeamRoleProfile', COUNT(*)::bigint FROM public.\"TeamRoleProfile\"
UNION ALL SELECT 'ImportImageIngestionRun', COUNT(*)::bigint FROM public.\"ImportImageIngestionRun\"
UNION ALL SELECT 'ImportImageIngestionJob', COUNT(*)::bigint FROM public.\"ImportImageIngestionJob\"
) TO './${SOURCE_COUNTS_FILE}' csv header" >/dev/null
record_ok "B5 Source row counts exported"

phase_log "Phase C: Restore to new target"
full_restore_ok=false
if [[ -s backup/sql/full_public_dump.sql ]]; then
  if safe_psql_target -v ON_ERROR_STOP=1 -f ./backup/sql/full_public_dump.sql > backup/reports/full_restore.log 2>&1; then
    full_restore_ok=true
    record_ok "C6 Full dump restore on target"
  else
    record_fail "C6 Full dump restore on target"
  fi
else
  record_fail "C6 Full dump restore skipped (file missing/empty)"
fi

fallback_restore_ok=false
if [[ "$full_restore_ok" != true ]]; then
  if [[ -s backup/sql/critical_tables_dump.sql ]]; then
    if safe_psql_target -v ON_ERROR_STOP=1 -f ./backup/sql/critical_tables_dump.sql > backup/reports/critical_restore.log 2>&1; then
      fallback_restore_ok=true
      record_ok "C7 Critical fallback restore on target"
    else
      record_fail "C7 Critical fallback restore on target"
    fi
  else
    record_fail "C7 Critical fallback restore skipped (file missing/empty)"
  fi
fi

safe_psql_target -v ON_ERROR_STOP=1 -c "\\copy (
SELECT 'AuctionSession' AS table_name, COUNT(*)::bigint AS row_count FROM public.\"AuctionSession\"
UNION ALL SELECT 'Team', COUNT(*)::bigint FROM public.\"Team\"
UNION ALL SELECT 'Player', COUNT(*)::bigint FROM public.\"Player\"
UNION ALL SELECT 'Transaction', COUNT(*)::bigint FROM public.\"Transaction\"
UNION ALL SELECT 'AuctionActionHistory', COUNT(*)::bigint FROM public.\"AuctionActionHistory\"
UNION ALL SELECT 'TeamRoleProfile', COUNT(*)::bigint FROM public.\"TeamRoleProfile\"
UNION ALL SELECT 'ImportImageIngestionRun', COUNT(*)::bigint FROM public.\"ImportImageIngestionRun\"
UNION ALL SELECT 'ImportImageIngestionJob', COUNT(*)::bigint FROM public.\"ImportImageIngestionJob\"
) TO './${TARGET_COUNTS_FILE}' csv header" >/dev/null
record_ok "C8 Target row counts exported"

{
  echo "table_name,source_count,target_count,diff"
  awk -F, 'NR==FNR{if(FNR>1) s[$1]=$2; next} FNR>1 {sc=(($1 in s)?s[$1]:0); tc=$2+0; print $1 "," sc "," tc "," (tc-sc)}' "$SOURCE_COUNTS_FILE" "$TARGET_COUNTS_FILE"
} > "$COUNT_DIFF_FILE"
record_ok "C8 Source-target count diff generated"

phase_log "Phase D: Data integrity checks"
{
  echo "check_name,issue_count"
  echo "broken_player_team_refs,$(safe_psql_target -At -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) FROM public.\"Player\" p LEFT JOIN public.\"Team\" t ON t.id=p.\"teamId\" WHERE p.\"teamId\" IS NOT NULL AND t.id IS NULL;")"
  echo "broken_transaction_refs,$(safe_psql_target -At -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) FROM public.\"Transaction\" tr LEFT JOIN public.\"Player\" p ON p.id=tr.\"playerId\" LEFT JOIN public.\"Team\" tm ON tm.id=tr.\"teamId\" LEFT JOIN public.\"AuctionSession\" s ON s.id=tr.\"sessionId\" WHERE p.id IS NULL OR tm.id IS NULL OR s.id IS NULL;")"
  echo "sell_actions_missing_transactionId,$(safe_psql_target -At -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) FROM public.\"AuctionActionHistory\" WHERE \"actionType\"='SELL' AND \"transactionId\" IS NULL;")"
  echo "action_history_transaction_not_found,$(safe_psql_target -At -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) FROM public.\"AuctionActionHistory\" ah LEFT JOIN public.\"Transaction\" tr ON tr.id=ah.\"transactionId\" WHERE ah.\"transactionId\" IS NOT NULL AND tr.id IS NULL;")"
  echo "team_pointsSpent_mismatch,$(safe_psql_target -At -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) FROM (SELECT tm.id, tm.\"pointsSpent\", COALESCE(SUM(tr.amount),0) AS tx_sum FROM public.\"Team\" tm LEFT JOIN public.\"Transaction\" tr ON tr.\"teamId\"=tm.id GROUP BY tm.id, tm.\"pointsSpent\") q WHERE q.\"pointsSpent\" <> q.tx_sum;")"
  echo "sold_players_without_teamId,$(safe_psql_target -At -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) FROM public.\"Player\" WHERE status='SOLD' AND \"teamId\" IS NULL;")"
} > "$INTEGRITY_FILE"
record_ok "D9 Integrity checks executed"

phase_log "Phase E: S3 URL migration"
safe_psql_target -v ON_ERROR_STOP=1 -c "\\copy (SELECT id, \"imageUrl\" FROM public.\"Player\") TO './backup/rollback/player_imageurl_backup.csv' csv header" >/dev/null
safe_psql_target -v ON_ERROR_STOP=1 -c "\\copy (SELECT id, \"imageUrl\" FROM public.\"TeamRoleProfile\") TO './backup/rollback/teamrole_imageurl_backup.csv' csv header" >/dev/null
record_ok "E10 Rollback snapshots created"

player_updated_count="$(safe_psql_target -At -v ON_ERROR_STOP=1 -c "WITH upd AS (UPDATE public.\"Player\" SET \"imageUrl\" = regexp_replace(\"imageUrl\", '^https?://[^/]+/storage/v1/(object/public|render/image/public)/player-images/', '${S3_PLAYER_IMAGES_PUBLIC_BASE}') WHERE \"imageUrl\" ~ '/storage/v1/(object/public|render/image/public)/player-images/' RETURNING 1) SELECT COUNT(*) FROM upd;")"
record_ok "E11 Player image URL rewrite to S3 base"

teamrole_updated_count=0
teamrole_skipped_count=0
icon_candidates_file="backup/reports/teamrole_icon_candidates.tsv"
safe_psql_target -At -F $'\t' -v ON_ERROR_STOP=1 -c "SELECT id, \"imageUrl\" FROM public.\"TeamRoleProfile\" WHERE \"imageUrl\" ~ '/storage/v1/(object/public|render/image/public)/icon-images/';" > "$icon_candidates_file"

if [[ -s "$icon_candidates_file" ]]; then
  while IFS=$'\t' read -r role_id role_url; do
    key="${role_url#*/storage/v1/object/public/icon-images/}"
    key="${key#*/storage/v1/render/image/public/icon-images/}"
    key="${key%%\?*}"

    if [[ "$key" == "$role_url" || -z "$key" ]]; then
      teamrole_skipped_count=$((teamrole_skipped_count + 1))
      continue
    fi

    new_url="${S3_ICON_IMAGES_PUBLIC_BASE}${key}"
    http_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$new_url" || true)"
    if [[ "$http_code" == "200" ]]; then
      safe_psql_target -v ON_ERROR_STOP=1 -c "UPDATE public.\"TeamRoleProfile\" SET \"imageUrl\"='${new_url}' WHERE id='${role_id}';" >/dev/null
      teamrole_updated_count=$((teamrole_updated_count + 1))
    else
      teamrole_skipped_count=$((teamrole_skipped_count + 1))
    fi
  done < "$icon_candidates_file"
fi
record_ok "E12 TeamRoleProfile icon URL rewrite/skip handling"

safe_psql_target -v ON_ERROR_STOP=1 -c "\\copy (SELECT id, \"imageUrl\" FROM public.\"Player\" WHERE \"imageUrl\" LIKE '${S3_PLAYER_IMAGES_PUBLIC_BASE}%' ORDER BY id LIMIT 20) TO './${PLAYER_SAMPLES_FILE}' csv header" >/dev/null
safe_psql_target -v ON_ERROR_STOP=1 -c "\\copy (SELECT id, \"imageUrl\" FROM public.\"TeamRoleProfile\" WHERE \"imageUrl\" LIKE '${S3_ICON_IMAGES_PUBLIC_BASE}%' ORDER BY id LIMIT 20) TO './${TEAMROLE_SAMPLES_FILE}' csv header" >/dev/null
remaining_player_supabase_count="$(safe_psql_target -At -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) FROM public.\"Player\" WHERE \"imageUrl\" LIKE '%supabase.co/storage%' OR \"imageUrl\" LIKE '%/storage/v1/%';")"
remaining_teamrole_supabase_count="$(safe_psql_target -At -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) FROM public.\"TeamRoleProfile\" WHERE \"imageUrl\" LIKE '%supabase.co/storage%' OR \"imageUrl\" LIKE '%/storage/v1/%';")"
record_ok "E13 URL rewrite verification and remaining supabase URL counts"

phase_log "Phase F: App smoke verification via data checks"
{
  echo "check_name,status,metric"

  v1="$(safe_psql_target -At -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) FROM public.\"Player\" p WHERE p.status='SOLD' AND NOT EXISTS (SELECT 1 FROM public.\"Transaction\" t WHERE t.\"playerId\"=p.id);")"
  [[ "$v1" == "0" ]] && echo "sold_players_have_transactions,PASS,$v1" || echo "sold_players_have_transactions,FAIL,$v1"

  v2="$(safe_psql_target -At -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) FROM public.\"Transaction\" t WHERE NOT EXISTS (SELECT 1 FROM public.\"AuctionActionHistory\" ah WHERE ah.\"transactionId\"=t.id AND ah.\"actionType\"='SELL');")"
  [[ "$v2" == "0" ]] && echo "transactions_have_sell_actions,PASS,$v2" || echo "transactions_have_sell_actions,FAIL,$v2"

  v3="$(safe_psql_target -At -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) FROM (SELECT tm.id, tm.\"pointsSpent\", COALESCE(SUM(tr.amount),0) AS tx_sum FROM public.\"Team\" tm LEFT JOIN public.\"Transaction\" tr ON tr.\"teamId\"=tm.id GROUP BY tm.id, tm.\"pointsSpent\") q WHERE q.\"pointsSpent\" <> q.tx_sum;")"
  [[ "$v3" == "0" ]] && echo "team_points_coherent,PASS,$v3" || echo "team_points_coherent,FAIL,$v3"

  v4="$(safe_psql_target -At -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) FROM public.\"Player\" p WHERE p.\"teamId\" IS NOT NULL AND p.status <> 'SOLD';")"
  [[ "$v4" == "0" ]] && echo "team_wise_export_precondition,PASS,$v4" || echo "team_wise_export_precondition,FAIL,$v4"

  v5="$(safe_psql_target -At -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) FROM public.\"AuctionActionHistory\" ah WHERE ah.\"actionType\"='SELL' AND ah.\"toPlayerId\" IS NULL;")"
  [[ "$v5" == "0" ]] && echo "auction_log_sell_entries_have_toPlayer,PASS,$v5" || echo "auction_log_sell_entries_have_toPlayer,FAIL,$v5"
} > "$SMOKE_FILE"
record_ok "F14 Smoke verification checks executed"

phase_log "Phase G: S3 refactor point mapping"
{
  echo "## S3 Refactor Points (Supabase storage usage)"
  echo
  for f in \
    src/app/api/admin/players/[id]/image/route.ts \
    src/app/api/admin/teams/[id]/roles/image/route.ts \
    src/features/player-import/imageIngestion.ts \
    src/features/icons-import/imageUpload.ts \
    scripts/storage/cleanup.ts \
    scripts/storage/recompress.ts \
    next.config.ts \
    src/lib/imageUrl.ts; do
    echo "### $f"
    if [[ -f "$f" ]]; then
      if rg -n "supabase\.storage|storage/v1|supabase\.co|PLAYER_IMAGES_BUCKET|ICON_IMAGES_BUCKET|createSignedUrl|upload\(" "$f" >/tmp/rg_hits.txt 2>/dev/null; then
        echo
        while IFS= read -r line; do
          echo "- $line"
        done </tmp/rg_hits.txt
      else
        echo
        echo "- No direct supabase.storage/string usage found"
      fi
    else
      echo
      echo "- File not found"
    fi
    echo
  done
} > backup/reports/s3_refactor_map.md
record_ok "G15 S3 refactor map generated (no code changes made)"

write_report
phase_log "Migration workflow complete. Report: $REPORT_FILE"
