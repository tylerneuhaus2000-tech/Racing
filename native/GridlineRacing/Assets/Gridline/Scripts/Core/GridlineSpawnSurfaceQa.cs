using System;
using UnityEngine;

namespace Gridline.Native
{
    // Reports the imported GLB surface directly beneath the logical start
    // samples. It never moves the car or changes collision/vehicle settings.
    public sealed class GridlineSpawnSurfaceQa : MonoBehaviour
    {
        private GridlineTrackData track;
        private bool active;
        private bool trackSweep;
        private bool complete;

        public void Configure(GridlineTrackData configuredTrack)
        {
            track = configuredTrack;
            trackSweep = HasArgument("-gridline-qa-track-sweep");
            active = HasArgument("-gridline-qa-spawn") || trackSweep;
        }

        private void Update()
        {
            if (!active || complete || track == null || !GridlineTrackCollision.IsBuilt) return;
            complete = true;
            Physics.queriesHitBackfaces = true;

            int[] samples =
            {
                0,
                Mathf.Clamp(Mathf.RoundToInt(track.startGridPct / 100f * (track.points.Length - 1)),
                    0, track.points.Length - 1),
                38
            };
            foreach (int index in samples)
            {
                Vector3 center = track.Point(index);
                RaycastHit[] hits = Physics.RaycastAll(center + Vector3.up * 12f,
                    Vector3.down, 40f, ~0, QueryTriggerInteraction.Ignore);
                RaycastHit[] upwardHits = Physics.RaycastAll(center - Vector3.up * 20f,
                    Vector3.up, 40f, ~0, QueryTriggerInteraction.Ignore);
                string hitSummary = hits.Length == 0
                    ? "none"
                    : string.Join(" | ", Array.ConvertAll(hits, hit =>
                        $"{hit.collider.name}@{hit.distance:0.00}m/{GridlineTrackCollision.SurfaceFor(hit.collider)}"));
                string upwardSummary = upwardHits.Length == 0
                    ? "none"
                    : string.Join(" | ", Array.ConvertAll(upwardHits, hit =>
                        $"{hit.collider.name}@{hit.distance:0.00}m/{GridlineTrackCollision.SurfaceFor(hit.collider)}"));
                float nearestDistance = float.PositiveInfinity;
                Vector3 nearestPoint = Vector3.zero;
                string nearestName = "none";
                foreach (RaycastHit hit in hits)
                {
                    GridlineTrackSurfaceTag tag = hit.collider.GetComponent<GridlineTrackSurfaceTag>();
                    if (tag == null || tag.Surface != GridlineSurface.Track) continue;
                    Vector3 point = hit.point;
                    float distance = Vector3.Distance(center, point);
                    if (distance >= nearestDistance) continue;
                    nearestDistance = distance;
                    nearestPoint = point;
                    nearestName = hit.collider.name;
                }
                foreach (RaycastHit hit in upwardHits)
                {
                    GridlineTrackSurfaceTag tag = hit.collider.GetComponent<GridlineTrackSurfaceTag>();
                    if (tag == null || tag.Surface != GridlineSurface.Track) continue;
                    Vector3 point = hit.point;
                    float distance = Vector3.Distance(center, point);
                    if (distance >= nearestDistance) continue;
                    nearestDistance = distance;
                    nearestPoint = point;
                    nearestName = hit.collider.name;
                }

                string nearestSummary = float.IsInfinity(nearestDistance)
                    ? "none"
                    : $"{nearestName}@{nearestDistance:0.00}m point={nearestPoint}";
                Debug.Log($"Gridline spawn probe index={index} center={center} "
                    + $"down={hitSummary} up={upwardSummary} nearestTrack={nearestSummary}");
                LogTrackSurfaceSearch(center);
                LogNearestTrackTriangles(center);
            }

            foreach (MeshCollider collider in FindObjectsOfType<MeshCollider>())
            {
                GridlineTrackSurfaceTag tag = collider.GetComponent<GridlineTrackSurfaceTag>();
                if (tag == null || tag.Surface != GridlineSurface.Track) continue;
                Debug.Log($"Gridline track collider probe name={collider.name} bounds={collider.bounds}");
            }

            if (trackSweep) RunCenterlineSweep();

            Application.Quit(0);
        }

        private void RunCenterlineSweep()
        {
            int misses = 0;
            int wrongSurface = 0;
            int firstMiss = -1;
            float maxVerticalDelta = 0f;
            float maxSurfaceGap = 0f;
            for (int index = 0; index < track.points.Length; index += 1)
            {
                Vector3 center = track.Point(index);
                RaycastHit[] hits = Physics.RaycastAll(center + Vector3.up * 20f,
                    Vector3.down, 80f, ~0, QueryTriggerInteraction.Ignore);
                bool foundTrack = false;
                float nearestGap = float.PositiveInfinity;
                foreach (RaycastHit hit in hits)
                {
                    GridlineTrackSurfaceTag tag = hit.collider.GetComponent<GridlineTrackSurfaceTag>();
                    if (tag == null || (tag.Surface != GridlineSurface.Track
                        && tag.Surface != GridlineSurface.Kerb)) continue;
                    foundTrack = true;
                    float gap = Vector2.Distance(
                        new Vector2(center.x, center.z),
                        new Vector2(hit.point.x, hit.point.z));
                    nearestGap = Mathf.Min(nearestGap, gap);
                    maxVerticalDelta = Mathf.Max(maxVerticalDelta,
                        Mathf.Abs(hit.point.y - center.y));
                }

                if (!foundTrack)
                {
                    misses += 1;
                    if (firstMiss < 0) firstMiss = index;
                    string candidates = hits.Length == 0
                        ? "none"
                        : string.Join(" | ", Array.ConvertAll(hits, hit =>
                            $"{hit.collider.name}/{GridlineTrackCollision.SurfaceFor(hit.collider)}"
                            + $"@{hit.point}"));
                    Debug.Log($"Gridline track sweep miss index={index} center={center} "
                        + $"candidates={candidates}");
                }
                else
                {
                    maxSurfaceGap = Mathf.Max(maxSurfaceGap, nearestGap);
                }

                foreach (RaycastHit hit in hits)
                {
                    GridlineTrackSurfaceTag tag = hit.collider.GetComponent<GridlineTrackSurfaceTag>();
                    if (tag != null && tag.Surface != GridlineSurface.Track
                        && tag.Surface != GridlineSurface.Kerb
                        && tag.Surface != GridlineSurface.Runoff
                        && tag.Surface != GridlineSurface.Grass
                        && tag.Surface != GridlineSurface.Gravel)
                    {
                        wrongSurface += 1;
                        break;
                    }
                }
            }

            bool passed = misses == 0 && wrongSurface == 0;
            Debug.Log($"Gridline track sweep {(passed ? "PASS" : "FAIL")}: "
                + $"samples={track.points.Length} misses={misses} firstMiss={firstMiss} "
                + $"wrongSurface={wrongSurface} maxVerticalDelta={maxVerticalDelta:0.00}m "
                + $"maxSurfaceGap={maxSurfaceGap:0.00}m");
        }

        private static void LogTrackSurfaceSearch(Vector3 center)
        {
            float bestHorizontal = float.PositiveInfinity;
            Vector3 bestHit = Vector3.zero;
            string bestName = "none";
            const int radius = 240;
            const int step = 12;
            for (int dx = -radius; dx <= radius; dx += step)
            {
                for (int dz = -radius; dz <= radius; dz += step)
                {
                    Vector3 origin = new Vector3(center.x + dx, center.y + 80f, center.z + dz);
                    RaycastHit[] hits = Physics.RaycastAll(origin, Vector3.down, 180f,
                        ~0, QueryTriggerInteraction.Ignore);
                    foreach (RaycastHit hit in hits)
                    {
                        GridlineTrackSurfaceTag tag = hit.collider.GetComponent<GridlineTrackSurfaceTag>();
                        if (tag == null || tag.Surface != GridlineSurface.Track) continue;
                        float horizontal = Vector2.Distance(
                            new Vector2(center.x, center.z),
                            new Vector2(hit.point.x, hit.point.z));
                        if (horizontal >= bestHorizontal) continue;
                        bestHorizontal = horizontal;
                        bestHit = hit.point;
                        bestName = hit.collider.name;
                    }
                }
            }

            string result = float.IsInfinity(bestHorizontal)
                ? "none"
                : $"{bestName} horizontal={bestHorizontal:0.00}m hit={bestHit}";
            Debug.Log($"Gridline track surface search center={center} result={result}");
        }

        private static void LogNearestTrackTriangles(Vector3 center)
        {
            foreach (MeshCollider collider in FindObjectsOfType<MeshCollider>())
            {
                GridlineTrackSurfaceTag tag = collider.GetComponent<GridlineTrackSurfaceTag>();
                Mesh mesh = collider.sharedMesh;
                if (tag == null || tag.Surface != GridlineSurface.Track || mesh == null) continue;

                Vector3[] vertices = mesh.vertices;
                int[] triangles = mesh.triangles;
                float bestDistance = float.PositiveInfinity;
                Vector3 bestPoint = Vector3.zero;
                Vector3 bestNormal = Vector3.zero;
                for (int i = 0; i + 2 < triangles.Length; i += 3)
                {
                    Vector3 a = collider.transform.TransformPoint(vertices[triangles[i]]);
                    Vector3 b = collider.transform.TransformPoint(vertices[triangles[i + 1]]);
                    Vector3 c = collider.transform.TransformPoint(vertices[triangles[i + 2]]);
                    Vector3 point = (a + b + c) / 3f;
                    float distance = Vector2.Distance(
                        new Vector2(center.x, center.z), new Vector2(point.x, point.z));
                    if (distance >= bestDistance) continue;
                    bestDistance = distance;
                    bestPoint = point;
                    bestNormal = Vector3.Cross(b - a, c - a).normalized;
                }

                Debug.Log($"Gridline track collision triangle probe name={collider.name} "
                    + $"nearestCentroid={bestDistance:0.00}m point={bestPoint} normal={bestNormal} "
                    + $"vertices={vertices.Length} triangles={triangles.Length / 3}");
            }
        }

        private static bool HasArgument(string expected)
        {
            string[] args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length; i += 1)
                if (args[i].Equals(expected, StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }
    }
}
