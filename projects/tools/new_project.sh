#!/usr/bin/env bash
# Scaffold a new vibe-coded project folder from projects/templates/.
#
#   projects/tools/new_project.sh <slug> "<Display Name>" "<one-line summary>" [group]
#
# Example:
#   projects/tools/new_project.sh timer_app "Timer App" "Pomodoro-style countdown timer"
#   projects/tools/new_project.sh snake "Snake" "Classic snake in canvas" games
set -euo pipefail

slug="${1:-}"; name="${2:-}"; summary="${3:-}"; group="${4:-}"
if [[ -z "$slug" || -z "$name" || -z "$summary" ]]; then
  sed -n '2,9p' "$0"; exit 1
fi
if [[ ! "$slug" =~ ^[a-z0-9]+(_[a-z0-9]+)*$ ]]; then
  echo "slug must be snake_case: $slug" >&2; exit 1
fi

root="$(cd "$(dirname "$0")/.." && pwd)"
tpl="$root/templates"
if [[ -n "$group" ]]; then
  dest="$root/$group/$slug"
else
  dest="$root/$slug"
fi
if [[ -e "$dest" ]]; then echo "already exists: $dest" >&2; exit 1; fi

date="$(date +%F)"
mkdir -p "$dest/src" "$dest/specs/001-$slug"

render() { # render <template> <out>
  sed -e "s|{{NAME}}|$name|g" -e "s|{{SLUG}}|$slug|g" \
      -e "s|{{SUMMARY}}|$summary|g" -e "s|{{DATE}}|$date|g" "$1" > "$2"
}

render "$tpl/project.yml"   "$dest/project.yml"
render "$tpl/prompts.md"    "$dest/prompts.md"
render "$tpl/DECISIONS.md"  "$dest/DECISIONS.md"
render "$tpl/EVALUATION.md" "$dest/EVALUATION.md"
render "$tpl/CHANGELOG.md"  "$dest/CHANGELOG.md"
if [[ -n "$group" ]]; then
  sed -i "s|^group: ~|group: $group|" "$dest/project.yml"
fi

# Spec Kit artifacts, seeded from the vendored templates
sk="$tpl/speckit"
sed -e "s|\[PROJECT_NAME\]|$name|g" "$sk/constitution-template.md" > "$dest/specs/constitution.md"
sed -e "s|\[FEATURE NAME\]|$name|g" -e "s|\[###-feature-name\]|001-$slug|g" -e "s|\[DATE\]|$date|g" \
    "$sk/spec-template.md"  > "$dest/specs/001-$slug/spec.md"
sed -e "s|\[FEATURE\]|$name|g"      -e "s|\[###-feature-name\]|001-$slug|g" -e "s|\[DATE\]|$date|g" \
    "$sk/plan-template.md"  > "$dest/specs/001-$slug/plan.md"
sed -e "s|\[FEATURE NAME\]|$name|g" -e "s|\[###-feature-name\]|001-$slug|g" \
    "$sk/tasks-template.md" > "$dest/specs/001-$slug/tasks.md"
cp "$sk/checklist-template.md" "$dest/specs/001-$slug/checklist.md"

cat > "$dest/src/.gitkeep" <<EOF
EOF

echo "created $dest"
echo "next:"
echo "  1. write $dest/specs/constitution.md"
echo "  2. round 1 in $dest/prompts.md  (Mode: speckit/specify)"
echo "  3. python3 $root/tools/build_index.py"
