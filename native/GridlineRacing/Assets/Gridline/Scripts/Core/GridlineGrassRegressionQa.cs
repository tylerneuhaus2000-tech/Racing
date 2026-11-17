using System;
using UnityEngine;

namespace Gridline.Native
{
    // Reproduces the reported grass transition on the imported Silverstone
    // surface. This never creates helper road geometry or changes vehicle setup.
    public sealed class GridlineGrassRegressionQa : MonoBehaviour
    {
        private const float GrassCorridorLength = 6f;
        private const float ThrottleProbeDuration = 0.60f;
        private const float ProbeMeasurementWarmup = 0.15f;

        private enum Phase
        {
            Idle,
            Settle,
            Driving,
            Complete
        }

        private GridlineVehicleController vehicle;
        private GridlineTrackData track;
        private Phase phase;
        private float phaseStartedAt;
        private bool active;
        private bool sampleFound;
        private bool grassSeen;
        private float minimumLocalForwardSpeed = float.PositiveInfinity;
        private float minimumRearTireForce = float.PositiveInfinity;
        private float maximumRearTireForce = float.NegativeInfinity;
        private float minimumFourWheelForwardSpeed = float.PositiveInfinity;
        private float minimumFourWheelRearTireForce = float.PositiveInfinity;
        private float minimumActiveProbeForwardSpeed = float.PositiveInfinity;
        private float minimumActiveProbeRearTireForce = float.PositiveInfinity;
        private int activeProbeSamples;
        private Vector3 minimumForwardSpeedPosition;
        private Vector3 minimumRearForcePosition;
        private bool minimumTelemetryLogged;
        private Vector3 samplePosition;
        private Quaternion sampleRotation;
        private int lastGroundedCount = -1;
        private int minimumGroundedCount = 4;
        private bool probeContactLost;

        public void Configure(GridlineVehicleController configuredVehicle, GridlineTrackData configuredTrack)
        {
            vehicle = configuredVehicle;
            track = configuredTrack;
            active = HasArgument("-gridline-qa-grass");
        }

        private void Update()
        {
            if (!active || phase == Phase.Complete || vehicle == null || track == null) return;

            if (phase == Phase.Idle)
            {
                if (!GridlineTrackCollision.IsBuilt) return;
                if (!TryFindGrassSample(out samplePosition, out sampleRotation))
                {
                    Complete(false, "no_full_vehicle_grass_surface_sample");
                    return;
                }

                GridlineGameState.StartDriving();
                vehicle.ResetForQa(samplePosition + Vector3.up * 0.48f,
                    sampleRotation);
                phase = Phase.Settle;
                phaseStartedAt = Time.unscaledTime;
                Debug.Log($"Gridline grass QA started: source=imported GLB surface={samplePosition}");
                return;
            }

            if (phase == Phase.Settle)
            {
                GridlineInputRouter.Instance?.SetExternalWheelInput(0f, 0f, 0f, 0f);
                if (Time.unscaledTime - phaseStartedAt >= 1f)
                {
                    if (vehicle.GroundedWheelCount < 3)
                    {
                        Complete(false, $"qa_driver_sample_not_settled_grounded={vehicle.GroundedWheelCount}/4");
                        return;
                    }
                    phase = Phase.Driving;
                    phaseStartedAt = Time.unscaledTime;
                    Debug.Log("Gridline grass QA throttle probe started: throttle=0.35 brake=0 steer=0");
                }
                return;
            }

            GridlineInputRouter.Instance?.SetExternalWheelInput(0.35f, 0f, 0f, 0f);
            if (Time.unscaledTime - phaseStartedAt >= ThrottleProbeDuration)
                Complete(Evaluate(), "completed");
        }

        private void FixedUpdate()
        {
            if (!active || phase != Phase.Driving || vehicle == null) return;
            minimumLocalForwardSpeed = Mathf.Min(minimumLocalForwardSpeed, vehicle.LocalForwardSpeed);
            minimumRearTireForce = Mathf.Min(minimumRearTireForce, vehicle.RearLongitudinalForceTelemetry);
            maximumRearTireForce = Mathf.Max(maximumRearTireForce, vehicle.RearLongitudinalForceTelemetry);
            if (vehicle.SurfaceLabel == "GRASS") grassSeen = true;
            minimumGroundedCount = Mathf.Min(minimumGroundedCount, vehicle.GroundedWheelCount);
            if (vehicle.GroundedWheelCount < 4) probeContactLost = true;
            // Judge force direction only while the complete car is supported
            // by grass. Once a moving sample leaves its grass patch, the
            // resulting fall is a QA-sample/coverage result, not tire force.
            if (vehicle.GroundedWheelCount == 4 && vehicle.SurfaceLabel == "GRASS")
            {
                float probeElapsed = Time.unscaledTime - phaseStartedAt;
                if (vehicle.LocalForwardSpeed < minimumFourWheelForwardSpeed)
                {
                    minimumFourWheelForwardSpeed = vehicle.LocalForwardSpeed;
                    minimumForwardSpeedPosition = vehicle.transform.position;
                }
                if (vehicle.RearLongitudinalForceTelemetry < minimumFourWheelRearTireForce)
                {
                    minimumFourWheelRearTireForce = vehicle.RearLongitudinalForceTelemetry;
                    minimumRearForcePosition = vehicle.transform.position;
                }
                // The first fixed steps after ResetForQa still contain the
                // suspension settling impulse. Measure the actual throttle
                // probe after that transient, without changing vehicle code.
                if (probeElapsed >= ProbeMeasurementWarmup)
                {
                    activeProbeSamples += 1;
                    minimumActiveProbeForwardSpeed = Mathf.Min(
                        minimumActiveProbeForwardSpeed, vehicle.LocalForwardSpeed);
                    minimumActiveProbeRearTireForce = Mathf.Min(
                        minimumActiveProbeRearTireForce, vehicle.RearLongitudinalForceTelemetry);
                }
                if (!minimumTelemetryLogged
                    && (vehicle.LocalForwardSpeed < -0.05f
                        || vehicle.RearLongitudinalForceTelemetry < -25f))
                {
                    minimumTelemetryLogged = true;
                    Debug.Log($"Gridline grass QA negative telemetry phase="
                        + (probeElapsed < ProbeMeasurementWarmup ? "warmup" : "active")
                        + $" position={vehicle.transform.position} "
                        + $"localV={vehicle.LocalForwardSpeed:0.000} "
                        + $"rearTireFx={vehicle.RearLongitudinalForceTelemetry:0.0} "
                        + $"engineFx={vehicle.EngineForceTelemetry:0.0} "
                        + $"rearDriveFx={vehicle.RearDriveForceTelemetry:0.0} "
                        + $"yaw={vehicle.YawRate:0.000} reverse={vehicle.ReverseEngaged}");
                }
            }
            if (vehicle.GroundedWheelCount != lastGroundedCount)
            {
                lastGroundedCount = vehicle.GroundedWheelCount;
                Debug.Log($"Gridline grass QA contact grounded={vehicle.GroundedWheelCount}/4 "
                    + $"surface={vehicle.SurfaceLabel} wheelSurfaces={vehicle.WheelSurfaceTelemetry} "
                    + $"position={vehicle.transform.position}");
                LogWheelRays();
            }
        }

        private bool Evaluate()
        {
            bool finite = !float.IsPositiveInfinity(minimumFourWheelForwardSpeed)
                && !float.IsPositiveInfinity(minimumFourWheelRearTireForce)
                && !float.IsNegativeInfinity(maximumRearTireForce);
            bool activeFinite = activeProbeSamples > 0
                && !float.IsPositiveInfinity(minimumActiveProbeForwardSpeed)
                && !float.IsPositiveInfinity(minimumActiveProbeRearTireForce);
            bool passed = sampleFound && grassSeen && finite && activeFinite
                && minimumActiveProbeForwardSpeed > -0.25f
                && minimumActiveProbeRearTireForce > -1f;
            Debug.Log($"Gridline grass QA {(passed ? "PASS" : "FAIL")}: "
                + $"surfaceSeen={grassSeen} minLocalV={minimumLocalForwardSpeed:0.000} "
                + $"minRearTireFx={minimumRearTireForce:0.0} maxRearTireFx={maximumRearTireForce:0.0} "
                + $"fourWheelMinLocalV={minimumFourWheelForwardSpeed:0.000} "
                + $"fourWheelMinRearTireFx={minimumFourWheelRearTireForce:0.0} "
                + $"activeMinLocalV={minimumActiveProbeForwardSpeed:0.000} "
                + $"activeMinRearTireFx={minimumActiveProbeRearTireForce:0.0} "
                + $"activeSamples={activeProbeSamples} warmup={ProbeMeasurementWarmup:0.00}s "
                + $"minLocalPos={minimumForwardSpeedPosition} minRearFxPos={minimumRearForcePosition} "
                + $"minGrounded={minimumGroundedCount}/4 engineFx={vehicle.EngineForceTelemetry:0.0} "
                + $"reverse={vehicle.ReverseEngaged} wheelSurfaces={vehicle.WheelSurfaceTelemetry} "
                + $"classification={(probeContactLost ? "QA_DRIVER_SAMPLE_EXITED_GRASS" : "NONE")}");
            return passed;
        }

        private void Complete(bool passed, string reason)
        {
            phase = Phase.Complete;
            GridlineInputRouter.Instance?.SetExternalWheelInput(0f, 0f, 0f, 0f);
            if (!passed)
            {
                Debug.Log($"Gridline grass QA FAIL: reason={reason} source=imported GLB");
            }
            Application.Quit(passed ? 0 : 1);
        }

        private bool TryFindGrassSample(out Vector3 point, out Quaternion rotation)
        {
            GridlineTrackSurfaceTag[] tags = FindObjectsByType<GridlineTrackSurfaceTag>(FindObjectsSortMode.None);
            for (int sampleIndex = 0; sampleIndex < track.points.Length; sampleIndex += 8)
            {
                Vector3 center = track.Point(sampleIndex);
                Vector3 forward = track.Forward(sampleIndex);
                Vector3 side = new Vector3(forward.z, 0f, -forward.x).normalized;
                for (int sideSign = -1; sideSign <= 1; sideSign += 2)
                {
                    for (int offsetIndex = 0; offsetIndex < 4; offsetIndex += 1)
                    {
                        float offset = track.halfWidth + 2.5f + offsetIndex * 2f;
                        Vector3 origin = center + side * (offset * sideSign) + Vector3.up * 25f;
                        foreach (RaycastHit hit in Physics.RaycastAll(origin, Vector3.down, 60f,
                            ~0, QueryTriggerInteraction.Ignore))
                        {
                            for (int tagIndex = 0; tagIndex < tags.Length; tagIndex += 1)
                            {
                                GridlineTrackSurfaceTag tag = tags[tagIndex];
                                if (tag == null || tag.Surface != GridlineSurface.Grass
                                    || tag.GetComponent<Collider>() != hit.collider
                                    || hit.normal.y < 0.65f) continue;
                                point = hit.point;
                                GridlineTrackData.Sample trackSample = track.Query(point);
                                Quaternion candidateRotation = Quaternion.LookRotation(
                                    trackSample.forward, Vector3.up);
                                if (!HasGrassCorridor(point, candidateRotation, tags)) continue;

                                sampleFound = true;
                                rotation = candidateRotation;
                                Debug.Log($"Gridline grass QA collider={hit.collider.name} "
                                    + $"bounds={hit.collider.bounds} hitNormal={hit.normal} "
                                    + $"footprint=4/4 corridor={GrassCorridorLength:0.0}m");
                                return true;
                            }
                        }
                    }
                }
            }

            point = default;
            rotation = Quaternion.identity;
            return false;
        }

        private static bool HasGrassCorridor(Vector3 groundPoint, Quaternion rotation,
            GridlineTrackSurfaceTag[] tags)
        {
            float[] offsets = { 0f, GrassCorridorLength * 0.5f, GrassCorridorLength };
            for (int i = 0; i < offsets.Length; i += 1)
            {
                Vector3 sample = groundPoint + rotation * Vector3.forward * offsets[i];
                if (!HasFullGrassFootprint(sample, rotation, tags)) return false;
            }
            return true;
        }

        private static bool HasFullGrassFootprint(Vector3 groundPoint, Quaternion rotation,
            GridlineTrackSurfaceTag[] tags)
        {
            Vector3 bodyPosition = groundPoint + Vector3.up * 0.48f;
            Vector3[] localMounts =
            {
                new Vector3(-0.92f, 0.36f, 1.42f),
                new Vector3(0.92f, 0.36f, 1.42f),
                new Vector3(-0.92f, 0.36f, -1.42f),
                new Vector3(0.92f, 0.36f, -1.42f)
            };
            for (int i = 0; i < localMounts.Length; i += 1)
            {
                Vector3 origin = bodyPosition + rotation * localMounts[i];
                bool grassHit = false;
                foreach (RaycastHit hit in Physics.RaycastAll(origin, rotation * Vector3.down,
                    1.04f, ~0, QueryTriggerInteraction.Ignore))
                {
                    if (hit.normal.y < 0.65f) continue;
                    for (int tagIndex = 0; tagIndex < tags.Length; tagIndex += 1)
                    {
                        GridlineTrackSurfaceTag tag = tags[tagIndex];
                        if (tag != null && tag.Surface == GridlineSurface.Grass
                            && tag.GetComponent<Collider>() == hit.collider)
                        {
                            grassHit = true;
                            break;
                        }
                    }
                    if (grassHit) break;
                }
                if (!grassHit) return false;
            }
            return true;
        }

        private void LogWheelRays()
        {
            Vector3[] localMounts =
            {
                new Vector3(-0.92f, 0.36f, 1.42f),
                new Vector3(0.92f, 0.36f, 1.42f),
                new Vector3(-0.92f, 0.36f, -1.42f),
                new Vector3(0.92f, 0.36f, -1.42f)
            };
            string[] labels = { "FL", "FR", "RL", "RR" };
            for (int i = 0; i < localMounts.Length; i += 1)
            {
                Vector3 origin = vehicle.transform.TransformPoint(localMounts[i]);
                RaycastHit[] hits = Physics.RaycastAll(origin, -vehicle.transform.up,
                    1.04f, ~0, QueryTriggerInteraction.Ignore);
                string summary = hits.Length == 0
                    ? "none"
                    : string.Join(" | ", Array.ConvertAll(hits, hit =>
                        $"{hit.collider.name}@{hit.distance:0.000}m/{GridlineTrackCollision.SurfaceFor(hit.collider)}"
                        + $" normalY={hit.normal.y:0.00} point={hit.point}"));
                Debug.Log($"Gridline grass QA wheelRay {labels[i]} origin={origin} hits={summary}");
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
