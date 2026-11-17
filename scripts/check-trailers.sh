#!/bin/sh
# Rejects AI co-author and session trailers. With a file argument (the commit-msg hook),
# checks that message; with --history, checks every commit reachable from HEAD.
pattern='^(Co-authored-by:.*(Claude|anthropic\.com|Copilot|openai)|Claude-Session:)|claude\.ai/code/session'
if [ "$1" = "--history" ]; then
  log=$(git log --format='%H%n%B' HEAD) || exit 1
  bad=$(printf '%s\n' "$log" | grep -Ei "$pattern")
else
  bad=$(grep -Ei "$pattern" "$1")
fi
if [ -n "$bad" ]; then
  echo "AI trailer or session link found; remove it:" >&2
  echo "$bad" >&2
  exit 1
fi
