#!/usr/bin/env bash
# Rename kebab-case *.md files to Title Case via the official Obsidian CLI.
# Backlinks are updated automatically by Obsidian's internal API.
#
# Prereqs:
#   - Obsidian v1.12.4+ with CLI registered
#       (Settings → General → Command line interface → Register CLI)
#   - Obsidian must be running
#   - Run from anywhere inside your vault (vault root is auto-detected)
#   - Settings → Files and Links → "Automatically update internal links" = ON
#
# Usage:
#   ./obsidian-retitle.sh                    # dry run on *.md in cwd
#   ./obsidian-retitle.sh --apply            # actually rename
#   ./obsidian-retitle.sh --apply path/*.md  # specific files (vault-relative)

set -euo pipefail

# Small words that stay lowercase unless they're the first word.
# Mirrors the small-words list in AGENTS_SPEC.md "Title and filename".
SMALL_WORDS=" a an the and but or nor for so yet at by from in into of on onto to up vs via with as "

apply=false
if [[ "${1:-}" == "--apply" ]]; then
    apply=true
    shift
fi

# Verify the Obsidian CLI is on PATH.
if ! command -v obsidian >/dev/null 2>&1; then
    echo "Error: 'obsidian' CLI not found." >&2
    echo "Enable it in Settings → General → Command line interface → Register CLI." >&2
    exit 1
fi

# Walk up from cwd to find the vault root (directory containing .obsidian/).
find_vault_root() {
    local dir
    dir=$(pwd -P)
    while [[ "$dir" != "/" && -n "$dir" ]]; do
        if [[ -d "$dir/.obsidian" ]]; then
            printf '%s\n' "$dir"
            return 0
        fi
        dir=$(dirname -- "$dir")
    done
    return 1
}

vault_root=$(find_vault_root) || {
    echo "Error: not inside an Obsidian vault (no .obsidian/ found in any parent)." >&2
    exit 1
}

# Convert a cwd-relative or absolute path to a vault-relative one.
to_vault_relative() {
    local file="$1"
    local abs_dir abs_path
    abs_dir=$(cd -- "$(dirname -- "$file")" 2>/dev/null && pwd -P) || return 1
    abs_path="$abs_dir/$(basename -- "$file")"
    if [[ "$abs_path" == "$vault_root"/* ]]; then
        printf '%s\n' "${abs_path#"$vault_root"/}"
    else
        return 1
    fi
}

# Default to *.md in current directory if no args.
if [[ $# -eq 0 ]]; then
    shopt -s nullglob
    set -- *.md
fi

renamed=0
skipped=0

for file in "$@"; do
    [[ -f "$file" ]] || continue
    base=$(basename -- "$file")

    # Skip files without hyphens (already title-cased or single word).
    [[ "$base" == *-* ]] || { skipped=$((skipped + 1)); continue; }

    name="${base%.md}"

    new_words=()
    i=0
    IFS='-' read -ra words <<< "$name"
    for word in "${words[@]}"; do
        lc=$(printf '%s' "$word" | tr '[:upper:]' '[:lower:]')
        if (( i == 0 )) || [[ "$SMALL_WORDS" != *" $lc "* ]]; then
            first=$(printf '%s' "${lc:0:1}" | tr '[:lower:]' '[:upper:]')
            new_words+=("${first}${lc:1}")
        else
            new_words+=("$lc")
        fi
        i=$((i + 1))
    done

    new_name="${new_words[*]}"

    if [[ "$name" == "$new_name" ]]; then
        skipped=$((skipped + 1))
        continue
    fi

    if ! vault_path=$(to_vault_relative "$file"); then
        echo "Skip: $file is outside the detected vault ($vault_root)" >&2
        skipped=$((skipped + 1))
        continue
    fi
    new_vault_path="$(dirname -- "$vault_path")/$new_name.md"
    # Normalize "./foo.md" → "foo.md" for files at the vault root.
    new_vault_path="${new_vault_path#./}"

    if $apply; then
        printf 'obsidian rename: %s → %s\n' "$vault_path" "$new_vault_path"
        # Note: the CLI preserves the .md extension when omitted from `name=`.
        obsidian rename path="$vault_path" name="$new_name"
    else
        printf 'DRY: %s → %s\n' "$vault_path" "$new_vault_path"
    fi

    renamed=$((renamed + 1))
done

echo "---"
if $apply; then
    echo "Renamed: $renamed. Skipped: $skipped."
else
    echo "Would rename: $renamed. Skipped: $skipped. (Re-run with --apply to execute.)"
fi
