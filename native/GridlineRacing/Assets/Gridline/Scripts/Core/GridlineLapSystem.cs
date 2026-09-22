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
        public float CurrentLapTime { get; private set; }
        public float LastLapTime { get; private set; }
        public float BestLapTime { get; private set; }
        public int CurrentSector { get; private set; } = 1;
        public float CurrentSectorTime { get; private set; }
        public float[] LastSectorTimes { get; } = new float[] { 0f, 0f, 0f };

        private int lastNearestIndex;
        private float previousProgress;
        private bool armed;
        private int nextSector = 1;

        public void Configure(GridlineVehicleController vehicle, GridlineTrackData track)
        {
            Vehicle = vehicle;
            Track = track;
            lastNearestIndex = 0;
            previousProgress = 0f;
            armed = false;
            ResetSession();
        }

        public void ResetSession()
        {
            CompletedLaps = 0;
            LapProgress = 0f;
            TrackDistance = 0f;
            IsValidLap = true;
            CurrentLapTime = 0f;
            LastLapTime = 0f;
            BestLapTime = 0f;
            CurrentSector = 1;
            CurrentSectorTime = 0f;
            nextSector = 1;
            previousProgress = 0f;
            lastNearestIndex = 0;
            armed = false;
            for (int i = 0; i < LastSectorTimes.Length; i += 1)
            {
                LastSectorTimes[i] = 0f;
            }
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
            CurrentLapTime += Time.fixedDeltaTime;
            CurrentSectorTime += Time.fixedDeltaTime;

            if (progress < previousProgress - 0.08f && previousProgress < 0.85f)
            {
                IsValidLap = false;
            }

            if (nextSector <= 2 && progress >= nextSector / 3f && previousProgress < nextSector / 3f)
            {
                LastSectorTimes[nextSector - 1] = CurrentSectorTime;
                CurrentSector = nextSector + 1;
                CurrentSectorTime = 0f;
                nextSector += 1;
            }

            if (armed && previousProgress > 0.85f && progress < 0.15f)
            {
                CompletedLaps += 1;
                LastLapTime = CurrentLapTime;
                if (IsValidLap && (BestLapTime <= 0f || LastLapTime < BestLapTime))
                {
                    BestLapTime = LastLapTime;
                }
                else if (!IsValidLap)
                {
                    Debug.Log("Gridline lap invalid: vehicle left the track limits or missed a sector.");
                }

                CurrentLapTime = 0f;
                CurrentSector = 1;
                CurrentSectorTime = 0f;
                nextSector = 1;
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
