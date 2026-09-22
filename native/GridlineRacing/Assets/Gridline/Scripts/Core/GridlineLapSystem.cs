using UnityEngine;

namespace Gridline.Native
{
    [DefaultExecutionOrder(-50)]
    public sealed class GridlineLapSystem : MonoBehaviour
    {
        public GridlineVehicleController Vehicle;
        public GridlineTrackData Track;
        public int CompletedLaps { get; private set; }
        public float LapProgress { get; private set; }
        public float TrackDistance { get; private set; }
        public bool IsValidLap { get; private set; } = true;

        private int lastNearestIndex;
        private float previousProgress;
        private bool armed;

        public void Configure(GridlineVehicleController vehicle, GridlineTrackData track)
        {
            Vehicle = vehicle;
            Track = track;
            lastNearestIndex = 0;
            previousProgress = 0f;
            armed = false;
        }

        private void FixedUpdate()
        {
            if (!GridlineGameState.IsDriving || Vehicle == null || Track == null)
            {
                return;
            }

            Vector3 position = Vehicle.transform.position;
            int nearestIndex = FindNearestPoint(position, lastNearestIndex);
            lastNearestIndex = nearestIndex;
            Vector3 center = Track.Point(nearestIndex);
            float lateralDistance = Vector3.ProjectOnPlane(position - center, Vector3.up).magnitude;
            if (lateralDistance > Track.halfWidth + 5f)
            {
                IsValidLap = false;
            }

            float progress = nearestIndex / (float)Track.points.Length;
            TrackDistance = progress * Track.lengthMeters;
            LapProgress = progress;

            if (armed && previousProgress > 0.85f && progress < 0.15f)
            {
                CompletedLaps += 1;
                if (!IsValidLap)
                {
                    Debug.Log("Gridline lap invalid: vehicle left the track limits.");
                }
                IsValidLap = true;
            }

            if (progress > 0.2f)
            {
                armed = true;
            }
            previousProgress = progress;
        }

        private int FindNearestPoint(Vector3 position, int hint)
        {
            int bestIndex = hint;
            float bestDistance = float.PositiveInfinity;
            const int searchRadius = 28;
            for (int offset = -searchRadius; offset <= searchRadius; offset += 1)
            {
                int index = (hint + offset % Track.points.Length + Track.points.Length) % Track.points.Length;
                float distance = (Track.Point(index) - position).sqrMagnitude;
                if (distance < bestDistance)
                {
                    bestDistance = distance;
                    bestIndex = index;
                }
            }

            return bestIndex;
        }
    }
}
