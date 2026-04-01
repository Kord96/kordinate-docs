#!/usr/bin/env python3
"""Build manifest.json and storyByNode.json from augur analysis output.

Usage:
    python build-manifest.py <project-path>

Reads:
    <project>/.kord/agents/augur/memory/atlas.json
    <project>/.kord/agents/augur/memory/stories/*.yaml
    <project>/.kord/agents/augur/memory/journeys/*.yaml

Writes:
    <project>/.kord/agents/scribe/output/manifest.json
    <project>/.kord/agents/scribe/output/storyByNode.json

Manifest decides rendering approach per story building block.
storyByNode maps atlas node IDs to the stories that reference them.
"""

import json
import sys
from pathlib import Path

import yaml


def load_yaml(path: Path) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def load_json(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)


def discover_project(arg: str) -> Path:
    candidates = [
        Path(arg),
        Path(f"/kord/projects/{arg}"),
        Path.home() / arg,
        Path.home() / "repos" / arg,
    ]
    for p in candidates:
        if p.is_dir():
            return p.resolve()
    print(f"Error: project '{arg}' not found.", file=sys.stderr)
    sys.exit(1)


def decide_structure_layout(nodes: list) -> str:
    n = len(nodes)
    if n <= 3:
        return "grid"
    elif n <= 8:
        return "dagre"
    else:
        return "cose-bilkent"


def decide_flow_layout(flow: dict) -> str:
    flow_type = flow.get("type", "")
    if flow_type in ("state", "failure-cascade"):
        return "timeline"
    return "sequence"


def decide_observation_layout(obs: dict) -> str:
    if obs.get("code_snippet") or obs.get("evidence"):
        return "evidence-card"
    if obs.get("recommendation"):
        return "warning-card"
    return "compact-card"


def build_manifest(stories: dict[str, dict]) -> dict:
    """Build rendering manifest from stories."""
    manifest = {}

    for story_id, story in stories.items():
        entry = {"blocks": []}

        # Structures
        for i, structure in enumerate(story.get("structures", [])):
            nodes = structure.get("nodes", [])
            entry["blocks"].append({
                "type": "structure",
                "index": i,
                "layout": decide_structure_layout(nodes),
                "node_count": len(nodes),
            })

        # Flows
        for i, flow in enumerate(story.get("flows", [])):
            entry["blocks"].append({
                "type": "flow",
                "index": i,
                "layout": decide_flow_layout(flow),
                "flow_type": flow.get("type", "data"),
            })

        # Observations
        for i, obs in enumerate(story.get("observations", [])):
            entry["blocks"].append({
                "type": "observation",
                "index": i,
                "layout": decide_observation_layout(obs),
            })

        # Rationale
        for i, _ in enumerate(story.get("rationale", [])):
            entry["blocks"].append({
                "type": "rationale",
                "index": i,
                "layout": "decision-card",
            })

        manifest[story_id] = entry

    return manifest


def build_story_by_node(stories: dict[str, dict]) -> dict[str, list[str]]:
    """Map atlas node IDs to the stories that reference them."""
    node_map: dict[str, set[str]] = {}

    for story_id, story in stories.items():
        # Collect node IDs from structures
        for structure in story.get("structures", []):
            for node in structure.get("nodes", []):
                nid = node.get("id") or node.get("node_id")
                if nid:
                    node_map.setdefault(nid, set()).add(story_id)
            for edge in structure.get("edges", []):
                for key in ("from", "to", "source", "target"):
                    nid = edge.get(key)
                    if nid:
                        node_map.setdefault(nid, set()).add(story_id)

        # Collect from flows
        for flow in story.get("flows", []):
            for step in flow.get("steps", []):
                for key in ("node", "to", "component"):
                    nid = step.get(key)
                    if nid:
                        node_map.setdefault(nid, set()).add(story_id)

        # Collect from observations
        for obs in story.get("observations", []):
            nid = obs.get("component") or obs.get("node")
            if nid:
                node_map.setdefault(nid, set()).add(story_id)

    # Convert sets to sorted lists
    return {k: sorted(v) for k, v in node_map.items()}


def validate(atlas: dict, stories: dict, journeys: list) -> list[str]:
    """Cross-reference validation. Returns list of warnings."""
    warnings = []

    # Collect all atlas node IDs
    atlas_nodes = set()
    for comp in atlas.get("components", []):
        if "id" in comp:
            atlas_nodes.add(comp["id"])
        for child in comp.get("children", []):
            if "id" in child:
                atlas_nodes.add(child["id"])

    # Check story node references
    for story_id, story in stories.items():
        for structure in story.get("structures", []):
            for node in structure.get("nodes", []):
                nid = node.get("id") or node.get("node_id")
                if nid and nid not in atlas_nodes:
                    warnings.append(f"story '{story_id}': node '{nid}' not in atlas")

    # Check journey story references
    story_ids = set(stories.keys())
    for journey in journeys:
        for sid in journey.get("stories", []):
            if sid not in story_ids:
                warnings.append(f"journey '{journey.get('id')}': story '{sid}' not found")

    return warnings


def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <project-path>", file=sys.stderr)
        sys.exit(1)

    project_dir = discover_project(sys.argv[1])
    augur_dir = project_dir / ".kord" / "agents" / "augur" / "memory"
    output_dir = project_dir / ".kord" / "agents" / "scribe" / "output"

    # Load atlas
    atlas_path = augur_dir / "atlas.json"
    if not atlas_path.exists():
        print(f"Error: {atlas_path} not found. Run augur /analyze first.", file=sys.stderr)
        sys.exit(1)
    atlas = load_json(atlas_path)

    # Load stories
    stories = {}
    story_dir = augur_dir / "stories"
    if story_dir.is_dir():
        for f in sorted(story_dir.glob("*.yaml")):
            story = load_yaml(f)
            if story and "id" in story:
                stories[story["id"]] = story
    print(f"Loaded {len(stories)} stories")

    # Load journeys
    journeys = []
    journey_dir = augur_dir / "journeys"
    if journey_dir.is_dir():
        for f in sorted(journey_dir.glob("*.yaml")):
            j = load_yaml(f)
            if j:
                journeys.append(j)
    print(f"Loaded {len(journeys)} journeys")

    # Validate
    warnings = validate(atlas, stories, journeys)
    if warnings:
        print(f"\nValidation warnings ({len(warnings)}):")
        for w in warnings:
            print(f"  - {w}")

    # Build manifest
    manifest = build_manifest(stories)
    total_blocks = sum(len(m["blocks"]) for m in manifest.values())

    # Build storyByNode
    story_by_node = build_story_by_node(stories)

    # Write output
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest_path = output_dir / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nWrote {manifest_path} ({len(manifest)} stories, {total_blocks} blocks)")

    sbn_path = output_dir / "storyByNode.json"
    with open(sbn_path, "w") as f:
        json.dump(story_by_node, f, indent=2)
    print(f"Wrote {sbn_path} ({len(story_by_node)} nodes mapped)")

    # Coverage
    atlas_node_count = len(set(
        comp.get("id", "")
        for comp in atlas.get("components", [])
        if comp.get("id")
    ))
    covered = len(story_by_node)
    pct = (covered / atlas_node_count * 100) if atlas_node_count > 0 else 0
    print(f"Coverage: {covered}/{atlas_node_count} atlas nodes in stories ({pct:.0f}%)")

    if warnings:
        sys.exit(1)


if __name__ == "__main__":
    main()
