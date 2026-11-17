using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gridline.Native
{
    // Runtime coverage probe for imported GLB surface colliders. It only
    // queries the existing meshes; it never changes vehicle or track physics.
    public sealed class GridlineSurfaceInteractionQa : MonoBehaviour
    {
        private static readonly GridlineSurface[] RequiredSurfaces =
        {
            GridlineSurface.Kerb,
            GridlineSurface.Grass,
            GridlineSurface.Runoff,
            GridlineSurface.Gravel,
            GridlineSurface.Barrier
        };

        private bool active;
        private bool complete;

        public void Configure()
        {
            active = HasArgument("-gridline-qa-surfaces");
        }

        private void Update()
        {
            if (!active || complete || !GridlineTrackCollision.IsBuilt) return;
            complete = true;
            Physics.queriesHitBackfaces = true;

            Dictionary<GridlineSurface, int> colliderCounts = new Dictionary<GridlineSurface, int>();
            Dictionary<GridlineSurface, string> hits = new Dictionary<GridlineSurface, string>();
            foreach (GridlineTrackSurfaceTag tag in FindObjectsOfType<GridlineTrackSurfaceTag>())
            {
                if (tag == null) continue;
                colliderCounts.TryGetValue(tag.Surface, out int count);
                colliderCounts[tag.Surface] = count + 1;

                if (hits.ContainsKey(tag.Surface)) continue;
                MeshCollider collider = tag.GetComponent<MeshCollider>();
                if (collider == null || collider.sharedMesh == null || !collider.enabled) continue;
                if (!TryHitMesh(collider, out RaycastHit hit)) continue;

                GridlineSurface hitSurface = GridlineTrackCollision.SurfaceFor(hit.collider);
                if (hitSurface != tag.Surface) continue;
                hits[tag.Surface] = $"{collider.name} point={hit.point} normal={hit.normal}";
            }

            bool passed = true;
            for (int i = 0; i < RequiredSurfaces.Length; i += 1)
            {
                GridlineSurface surface = RequiredSurfaces[i];
                colliderCounts.TryGetValue(surface, out int count);
                bool hit = hits.TryGetValue(surface, out string detail);
                passed &= count > 0 && hit;
                Debug.Log($"Gridline surface QA surface={surface} colliders={count} "
                    + $"rayHit={hit} detail={detail ?? "none"}");
            }

            Debug.Log($"Gridline surface QA {(passed ? "PASS" : "FAIL")}: "
                + "imported GLB collider classification and ray interaction");
            Application.Quit(passed ? 0 : 1);
        }

        private static bool TryHitMesh(MeshCollider collider, out RaycastHit bestHit)
        {
            Mesh mesh = collider.sharedMesh;
            if (mesh == null) { bestHit = default; return false; }

            GridlineSurface surface = GridlineTrackCollision.SurfaceFor(collider);
            bool barrier = surface == GridlineSurface.Barrier;
            Vector3[] vertices = mesh.vertices;
            int[] triangles = mesh.triangles;
            Vector3 candidatePoint = default;
            Vector3 candidateNormal = default;
            float candidateScore = float.NegativeInfinity;
            for (int i = 0; i + 2 < triangles.Length; i += 3)
            {
                Vector3 a = collider.transform.TransformPoint(vertices[triangles[i]]);
                Vector3 b = collider.transform.TransformPoint(vertices[triangles[i + 1]]);
                Vector3 c = collider.transform.TransformPoint(vertices[triangles[i + 2]]);
                Vector3 normal = Vector3.Cross(b - a, c - a);
                if (normal.sqrMagnitude < 0.000001f) continue;
                normal.Normalize();
                if (!barrier && normal.y < 0f) normal = -normal;
                float score = barrier
                    ? 1f - Mathf.Abs(normal.y)
                    : normal.y;
                if (score <= candidateScore) continue;
                candidateScore = score;
                candidatePoint = (a + b + c) / 3f;
                candidateNormal = normal;
            }

            if (candidateScore <= 0f) { bestHit = default; return false; }
            Ray ray = new Ray(candidatePoint + candidateNormal * 2f, -candidateNormal);
            if (collider.Raycast(ray, out bestHit, 4f)) return true;
            ray = new Ray(candidatePoint - candidateNormal * 2f, candidateNormal);
            return collider.Raycast(ray, out bestHit, 4f);
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
