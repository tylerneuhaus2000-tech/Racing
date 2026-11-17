using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gridline.Native
{
    public enum GridlineSurface
    {
        Track,
        Kerb,
        Grass,
        Runoff,
        Gravel,
        Barrier
    }

    [Serializable]
    public sealed class GridlineTrackPoint
    {
        public float x;
        public float y;
        public float z;

        public Vector3 ToUnityPosition() => new Vector3(x, y, z);
    }

    [Serializable]
    public sealed class GridlineTrackData
    {
        [Serializable]
        public struct Sample
        {
            public int index;
            public Vector3 position;
            public Vector3 forward;
            public Vector3 side;
            public float lateral;
            public float groundY;
            public float slope;
            public float progress;
            public float distance;
            public bool onTrack;
            public GridlineSurface surface;
        }

        public string id;
        public string name;
        public string source;
        public float halfWidth;
        public float lengthMeters;
        public bool reverseDirection;
        public float startGridPct;
        public GridlineTrackPoint[] points;

        // Browser parity: Track.buildSpline() uses Catmull-Rom samples spaced
        // by arc length. Keeping these distances avoids assuming every sample
        // has identical length on elevation changes and tight corners.
        [NonSerialized] private float[] sampleDistances;

        public static GridlineTrackData Load(string resourcePath)
        {
            TextAsset asset = Resources.Load<TextAsset>(resourcePath);
            if (asset == null)
            {
                Debug.LogError($"Gridline track data missing: Resources/{resourcePath}.json");
                return null;
            }

            GridlineTrackData track = JsonUtility.FromJson<GridlineTrackData>(asset.text);
            if (track == null || track.points == null || track.points.Length < 4)
            {
                Debug.LogError($"Gridline track data invalid: {resourcePath}");
                return null;
            }

            if (track.halfWidth <= 0f) track.halfWidth = 10f;
            if (track.reverseDirection)
            {
                // Keep point 0 as the start/finish anchor while changing the
                // traversal direction. This keeps the imported GLB and the
                // timing line at the exact same world position.
                Array.Reverse(track.points, 1, track.points.Length - 1);
            }
            track.ResampleToBrowserSpline();
            return track;
        }

        public static GridlineTrackData CreateVehicleTestFacility()
        {
            const float halfX = 360f;
            const float halfZ = 190f;
            const float radius = 95f;
            const int cornerSamples = 26;
            List<GridlineTrackPoint> source = new List<GridlineTrackPoint>();

            AddLine(source, new Vector3(-halfX + radius, 0f, -halfZ),
                new Vector3(halfX - radius, 0f, -halfZ), 24);
            AddArc(source, new Vector3(halfX - radius, 0f, -halfZ + radius), radius,
                -90f, 0f, cornerSamples);
            AddLine(source, new Vector3(halfX, 0f, -halfZ + radius),
                new Vector3(halfX, 0f, halfZ - radius), 18);
            AddArc(source, new Vector3(halfX - radius, 0f, halfZ - radius), radius,
                0f, 90f, cornerSamples);
            AddLine(source, new Vector3(halfX - radius, 0f, halfZ),
                new Vector3(-halfX + radius, 0f, halfZ), 24);
            AddArc(source, new Vector3(-halfX + radius, 0f, halfZ - radius), radius,
                90f, 180f, cornerSamples);
            AddLine(source, new Vector3(-halfX, 0f, halfZ - radius),
                new Vector3(-halfX, 0f, -halfZ + radius), 18);
            AddArc(source, new Vector3(-halfX + radius, 0f, -halfZ + radius), radius,
                180f, 270f, cornerSamples);

            GridlineTrackData track = new GridlineTrackData
            {
                id = "vehicle-test-facility",
                name = "GRIDLINE Vehicle Dynamics Facility",
                source = "native procedural vehicle test facility",
                halfWidth = 24f,
                lengthMeters = 0f,
                reverseDirection = false,
                startGridPct = 0f,
                points = source.ToArray()
            };
            track.ResampleToBrowserSpline();
            return track;
        }

        private static void AddLine(List<GridlineTrackPoint> target, Vector3 from, Vector3 to, int count)
        {
            for (int i = target.Count == 0 ? 0 : 1; i <= count; i += 1)
            {
                Vector3 point = Vector3.Lerp(from, to, i / (float)count);
                target.Add(new GridlineTrackPoint { x = point.x, y = point.y, z = point.z });
            }
        }

        private static void AddArc(List<GridlineTrackPoint> target, Vector3 center, float radius,
            float startDegrees, float endDegrees, int count)
        {
            for (int i = target.Count == 0 ? 0 : 1; i <= count; i += 1)
            {
                float angle = Mathf.Lerp(startDegrees, endDegrees, i / (float)count) * Mathf.Deg2Rad;
                Vector3 point = center + new Vector3(Mathf.Cos(angle), 0f, Mathf.Sin(angle)) * radius;
                target.Add(new GridlineTrackPoint { x = point.x, y = point.y, z = point.z });
            }
        }

        public Vector3 Point(int index)
        {
            int wrapped = (index % points.Length + points.Length) % points.Length;
            return points[wrapped].ToUnityPosition();
        }

        public Vector3 Forward(int index)
        {
            Vector3 tangent = Point(index + 1) - Point(index - 1);
            tangent.y = 0f;
            return tangent.sqrMagnitude > 0.0001f ? tangent.normalized : Vector3.forward;
        }

        public Sample Query(Vector3 worldPosition, int hint = -1)
        {
            int bestIndex = hint >= 0 ? hint % points.Length : 0;
            int hintIndex = bestIndex;
            float bestDistance = float.PositiveInfinity;
            Vector3 bestPoint = Point(bestIndex);
            Vector3 bestForward = Forward(bestIndex);
            float bestGroundY = bestPoint.y;
            float bestSlope = 0f;
            float bestDistanceAlong = 0f;
            float bestScore = float.PositiveInfinity;

            // Silverstone is resampled to roughly 2,000 points. A full search
            // every 120 Hz physics step needlessly dominated the main thread.
            // Keep the continuity protection, but search the local neighbourhood
            // first and retain a global fallback if the car genuinely teleports
            // or leaves that neighbourhood.
            bool useLocalWindow = hint >= 0 && points.Length > 128;
            int localRadius = useLocalWindow ? 32 : 0;
            int searchStart = useLocalWindow ? -localRadius : 0;
            int searchEnd = useLocalWindow ? localRadius : points.Length - 1;
            for (int offset = searchStart; offset <= searchEnd; offset += 1)
            {
                int i = useLocalWindow
                    ? (hintIndex + offset + points.Length) % points.Length
                    : offset;
                Vector3 a = Point(i);
                Vector3 b = Point(i + 1);
                Vector3 segment = b - a;
                segment.y = 0f;
                float segmentLengthSq = segment.sqrMagnitude;
                Vector3 flatDelta = new Vector3(worldPosition.x - a.x, 0f, worldPosition.z - a.z);
                float t = segmentLengthSq > 0.0001f
                    ? Mathf.Clamp01(Vector3.Dot(flatDelta, segment) / segmentLengthSq)
                    : 0f;
                Vector3 candidate = Vector3.Lerp(a, b, t);
                candidate.y = Mathf.Lerp(a.y, b.y, t);
                Vector3 flatCandidate = new Vector3(candidate.x, 0f, candidate.z);
                float distanceSq = (new Vector3(worldPosition.x, 0f, worldPosition.z) - flatCandidate).sqrMagnitude;
                // Silverstone has nearby parallel asphalt around the pit
                // entry and S/F. Prefer the continuous neighbourhood of the
                // previous segment so the car cannot teleport to a different
                // piece of road just because it is a few centimetres closer.
                float score = distanceSq;
                if (hint >= 0 && CircularIndexDistance(i, hintIndex, points.Length) > 24)
                {
                    score += 1000000f;
                }
                if (score >= bestScore) continue;

                bestScore = score;
                bestDistance = distanceSq;
                bestIndex = i;
                bestPoint = candidate;
                bestForward = segmentLengthSq > 0.0001f ? segment.normalized : Forward(i);
                bestGroundY = candidate.y;
                bestSlope = segmentLengthSq > 0.0001f ? (b.y - a.y) / Mathf.Sqrt(segmentLengthSq) : 0f;
                float segmentDistance = Vector3.Distance(a, b);
                float distanceAtSegment = sampleDistances != null && sampleDistances.Length == points.Length
                    ? sampleDistances[i]
                    : (i / (float)points.Length) * lengthMeters;
                bestDistanceAlong = distanceAtSegment + segmentDistance * t;
            }

            // If the car has genuinely left the local neighbourhood, allow a
            // global recovery query instead of locking it to an old segment.
            if (hint >= 0 && bestDistance > 900f)
            {
                return Query(worldPosition, -1);
            }

            // The last segment ends exactly at the first point. At S/F both
            // candidates can be equally close, and floating point rounding
            // may otherwise report 100% while the car is standing at 0%.
            Vector3 startPoint = Point(0);
            Vector3 startDelta = new Vector3(worldPosition.x - startPoint.x, 0f, worldPosition.z - startPoint.z);
            if (startDelta.sqrMagnitude <= 16f)
            {
                bestIndex = 0;
                bestPoint = startPoint;
                bestForward = Forward(0);
                bestGroundY = startPoint.y;
                bestSlope = 0f;
                bestDistanceAlong = 0f;
            }

            Vector3 side = new Vector3(bestForward.z, 0f, -bestForward.x).normalized;
            Vector3 delta = new Vector3(worldPosition.x - bestPoint.x, 0f, worldPosition.z - bestPoint.z);
            float lateral = Vector3.Dot(delta, side);
            float progress = lengthMeters > 0.1f
                ? Mathf.Repeat(bestDistanceAlong / lengthMeters, 1f)
                : (bestIndex + 0.5f) / points.Length;
            float lateralDistance = Mathf.Abs(lateral);
            GridlineSurface surface = lateralDistance <= halfWidth
                ? GridlineSurface.Track
                : lateralDistance <= halfWidth + 1.8f
                    ? GridlineSurface.Kerb
                    : lateralDistance <= halfWidth + 8f
                        ? GridlineSurface.Runoff
                        : GridlineSurface.Grass;

            return new Sample
            {
                index = bestIndex,
                position = bestPoint,
                forward = bestForward,
                side = side,
                lateral = lateral,
                groundY = bestGroundY,
                slope = bestSlope,
                progress = progress,
                distance = bestDistanceAlong,
                onTrack = lateralDistance <= halfWidth + 1.5f,
                surface = surface
            };
        }

        private static int CircularIndexDistance(int a, int b, int count)
        {
            int direct = Mathf.Abs(a - b);
            return Mathf.Min(direct, count - direct);
        }

        private void ResampleToBrowserSpline()
        {
            if (points == null || points.Length < 4) return;

            Vector3[] controlPoints = new Vector3[points.Length];
            for (int i = 0; i < points.Length; i += 1)
                controlPoints[i] = points[i].ToUnityPosition();

            // THREE.Curve.getLengths() defaults to 200 divisions. The web
            // game uses that arc-length table in getSpacedPoints(), so mirror
            // it instead of substituting a different spline approximation.
            const int arcLengthDivisions = 200;
            Vector3 previous = EvaluateCatmullRom(controlPoints, 0f);
            float[] arcLengths = new float[arcLengthDivisions + 1];
            arcLengths[0] = 0f;
            for (int i = 1; i <= arcLengthDivisions; i += 1)
            {
                Vector3 current = EvaluateCatmullRom(controlPoints, i / (float)arcLengthDivisions);
                arcLengths[i] = arcLengths[i - 1] + Vector3.Distance(previous, current);
                previous = current;
            }

            float totalLength = arcLengths[arcLengthDivisions];
            int sampleCount = Mathf.Max(400, Mathf.RoundToInt(totalLength / 3f));
            GridlineTrackPoint[] spacedPoints = new GridlineTrackPoint[sampleCount];
            sampleDistances = new float[sampleCount];

            Vector3 previousSample = Vector3.zero;
            for (int i = 0; i < sampleCount; i += 1)
            {
                float targetDistance = totalLength * i / sampleCount;
                float curveParameter = MapArcDistanceToParameter(arcLengths, targetDistance);
                Vector3 position = EvaluateCatmullRom(controlPoints, curveParameter);
                spacedPoints[i] = new GridlineTrackPoint
                {
                    x = position.x,
                    y = position.y,
                    z = position.z
                };
                sampleDistances[i] = i == 0
                    ? 0f
                    : sampleDistances[i - 1] + Vector3.Distance(position, previousSample);
                previousSample = position;
            }

            // Web Track.totalLen is the Catmull-Rom curve length, not the
            // rounded source metadata value. Lap timing and progress use it.
            points = spacedPoints;
            lengthMeters = totalLength;
        }

        private static Vector3 EvaluateCatmullRom(Vector3[] controlPoints, float parameter)
        {
            int count = controlPoints.Length;
            float scaled = Mathf.Clamp01(parameter) * count;
            int segment = Mathf.FloorToInt(scaled) % count;
            float weight = scaled - Mathf.Floor(scaled);
            int previous = (segment - 1 + count) % count;
            int next = (segment + 1) % count;
            int nextNext = (segment + 2) % count;
            Vector3 p0 = controlPoints[previous];
            Vector3 p1 = controlPoints[segment];
            Vector3 p2 = controlPoints[next];
            Vector3 p3 = controlPoints[nextNext];
            float weight2 = weight * weight;
            float weight3 = weight2 * weight;

            return 0.5f * (
                2f * p1
                + (-p0 + p2) * weight
                + (2f * p0 - 5f * p1 + 4f * p2 - p3) * weight2
                + (-p0 + 3f * p1 - 3f * p2 + p3) * weight3);
        }

        private static float MapArcDistanceToParameter(float[] arcLengths, float targetDistance)
        {
            if (targetDistance <= 0f) return 0f;
            int last = arcLengths.Length - 1;
            if (targetDistance >= arcLengths[last]) return 1f;

            int low = 0;
            int high = last;
            while (low + 1 < high)
            {
                int middle = (low + high) / 2;
                if (arcLengths[middle] < targetDistance) low = middle;
                else high = middle;
            }

            float sectionLength = arcLengths[high] - arcLengths[low];
            float sectionT = sectionLength > 0.0001f
                ? (targetDistance - arcLengths[low]) / sectionLength
                : 0f;
            return (low + sectionT) / (arcLengths.Length - 1f);
        }
    }
}
