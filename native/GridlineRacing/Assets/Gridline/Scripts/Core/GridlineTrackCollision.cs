using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gridline.Native
{
    public sealed class GridlineTrackSurfaceTag : MonoBehaviour
    {
        public GridlineSurface Surface;
        public string MaterialName;
    }

    public static class GridlineTrackCollision
    {
        public static bool IsBuilt { get; private set; }
        public static int ColliderCount { get; private set; }

        private enum CollisionGroup
        {
            None,
            Track,
            Kerb,
            Grass,
            Runoff,
            Gravel,
            Barrier
        }

        public static int Build(Transform importedRoot)
        {
            if (importedRoot == null || importedRoot.Find("__GridlineTrackCollision") != null)
            {
                IsBuilt = importedRoot != null && importedRoot.Find("__GridlineTrackCollision") != null;
                return 0;
            }

            GameObject root = new GameObject("__GridlineTrackCollision");
            root.transform.SetParent(importedRoot, false);
            int colliderCount = 0;
            int trackCount = 0;
            int kerbCount = 0;
            int grassCount = 0;
            int runoffCount = 0;
            int gravelCount = 0;
            int barrierCount = 0;
            int trackTriangles = 0;
            Bounds trackBounds = default(Bounds);
            bool hasTrackBounds = false;

            foreach (MeshFilter filter in importedRoot.GetComponentsInChildren<MeshFilter>(true))
            {
                if (filter.sharedMesh == null) continue;
                MeshRenderer renderer = filter.GetComponent<MeshRenderer>();
                if (renderer == null) continue;

                Dictionary<CollisionGroup, List<int>> triangles = new Dictionary<CollisionGroup, List<int>>();
                for (int subMesh = 0; subMesh < filter.sharedMesh.subMeshCount; subMesh += 1)
                {
                    string materialName = string.Empty;
                    if (subMesh < renderer.sharedMaterials.Length && renderer.sharedMaterials[subMesh] != null)
                    {
                        materialName = renderer.sharedMaterials[subMesh].name;
                    }

                    CollisionGroup group = Classify(materialName);
                    if (group == CollisionGroup.None) continue;

                    int[] indices;
                    try
                    {
                        if (filter.sharedMesh.GetTopology(subMesh) != MeshTopology.Triangles) continue;
                        // Ask Unity to apply the submesh base vertex exactly
                        // once. Applying GetBaseVertex manually after reading
                        // an already-resolved glTFast index buffer shifts some
                        // Silverstone road subsets by tens of metres.
                        indices = filter.sharedMesh.GetIndices(subMesh, true);
                    }
                    catch (Exception)
                    {
                        continue;
                    }

                    if (indices.Length < 3) continue;
                    if (!triangles.TryGetValue(group, out List<int> groupTriangles))
                    {
                        groupTriangles = new List<int>();
                        triangles.Add(group, groupTriangles);
                    }
                    groupTriangles.AddRange(indices);
                }

                foreach (KeyValuePair<CollisionGroup, List<int>> entry in triangles)
                {
                    bool useOriginalMesh = triangles.Count == 1
                        && filter.sharedMesh.subMeshCount == 1
                        && renderer.sharedMaterials.Length == 1;
                    Mesh collisionMesh = useOriginalMesh
                        ? filter.sharedMesh
                        : CreateSubsetMesh(filter.sharedMesh, entry.Value,
                            $"{filter.sharedMesh.name}_{entry.Key}", filter.transform, importedRoot);
                    if (collisionMesh == null) continue;

                    GameObject colliderObject = new GameObject(
                        $"{filter.name} · {entry.Key} collision");
                    // For a single-material primitive, retain the exact
                    // imported mesh and hierarchy transform. This avoids
                    // rebuilding glTFast's vertex/index mapping and keeps
                    // collision triangles identical to the visible road.
                    colliderObject.transform.SetParent(
                        useOriginalMesh ? filter.transform : root.transform, false);
                    colliderObject.transform.localPosition = Vector3.zero;
                    colliderObject.transform.localRotation = Quaternion.identity;
                    colliderObject.transform.localScale = Vector3.one;
                    colliderObject.layer = importedRoot.gameObject.layer;

                    MeshCollider collider = colliderObject.AddComponent<MeshCollider>();
                    collider.sharedMesh = collisionMesh;
                    collider.convex = false;
                    if (HasArgument("-gridline-qa-disable-track-collision"))
                    {
                        // Diagnostic-only A/B switch. Keep the imported
                        // collider objects and surface tags, but remove their
                        // physics cost for a short performance comparison.
                        collider.enabled = false;
                    }

                    GridlineTrackSurfaceTag tag = colliderObject.AddComponent<GridlineTrackSurfaceTag>();
                    tag.Surface = ToSurface(entry.Key);
                    tag.MaterialName = MaterialNameFor(filter, entry.Key);
                    if (entry.Key == CollisionGroup.Track)
                    {
                        Debug.Log($"Gridline track collision subset source={filter.name} "
                            + $"mesh={filter.sharedMesh.name} material={tag.MaterialName} "
                            + $"triangles={entry.Value.Count / 3} "
                            + $"mode={(useOriginalMesh ? "original-mesh" : "subset") } "
                            + $"localPosition={filter.transform.localPosition} "
                            + $"localScale={filter.transform.localScale}");
                    }
                    colliderCount += 1;
                    int triangleCount = entry.Value.Count / 3;
                    switch (entry.Key)
                    {
                        case CollisionGroup.Track:
                            trackCount += 1;
                            trackTriangles += triangleCount;
                            if (!hasTrackBounds)
                            {
                                trackBounds = collider.bounds;
                                hasTrackBounds = true;
                            }
                            else
                            {
                                trackBounds.Encapsulate(collider.bounds);
                            }
                            break;
                        case CollisionGroup.Kerb: kerbCount += 1; break;
                        case CollisionGroup.Grass: grassCount += 1; break;
                        case CollisionGroup.Runoff: runoffCount += 1; break;
                        case CollisionGroup.Gravel: gravelCount += 1; break;
                        case CollisionGroup.Barrier: barrierCount += 1; break;
                    }
                }

            }

            ColliderCount = colliderCount;
            IsBuilt = colliderCount > 0;
            Debug.Log($"Gridline imported track collision built: {colliderCount} mesh colliders "
                + $"track={trackCount}/{trackTriangles}tri kerb={kerbCount} grass={grassCount} "
                + $"runoff={runoffCount} gravel={gravelCount} barrier={barrierCount} "
                + $"trackBoundsCenter={trackBounds.center} trackBoundsSize={trackBounds.size}");
            if (HasArgument("-gridline-qa-disable-track-collision"))
                Debug.Log("Gridline collision diagnostic: imported track colliders disabled; surface tags retained");
            return colliderCount;
        }

        private static bool HasArgument(string expected)
        {
            string[] args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length; i += 1)
                if (string.Equals(args[i], expected, StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }

        public static GridlineSurface SurfaceFor(Collider collider)
        {
            if (collider == null) return GridlineSurface.Track;
            GridlineTrackSurfaceTag tag = collider.GetComponent<GridlineTrackSurfaceTag>();
            if (tag != null) return tag.Surface;

            string name = collider.name.ToLowerInvariant();
            if (name.Contains("barrier") || name.Contains("wall") || name.Contains("fence"))
                return GridlineSurface.Barrier;
            if (name.Contains("kerb") || name.Contains("curb") || name.Contains("rumble"))
                return GridlineSurface.Kerb;
            if (name.Contains("grass"))
                return GridlineSurface.Grass;
            if (name.Contains("gravel") || name.Contains("stone"))
                return GridlineSurface.Gravel;
            if (name.Contains("sand") || name.Contains("runoff"))
                return GridlineSurface.Runoff;
            return GridlineSurface.Track;
        }

        private static string MaterialNameFor(MeshFilter filter, CollisionGroup group)
        {
            if (filter == null) return group.ToString();
            MeshRenderer renderer = filter.GetComponent<MeshRenderer>();
            if (renderer == null) return group.ToString();
            for (int i = 0; i < renderer.sharedMaterials.Length; i += 1)
            {
                Material material = renderer.sharedMaterials[i];
                if (material != null && Classify(material.name) == group) return material.name;
            }
            return group.ToString();
        }

        private static Mesh CreateSubsetMesh(Mesh source, List<int> indices, string name,
            Transform sourceTransform, Transform collisionRoot)
        {
            if (indices == null || indices.Count < 3) return null;
            Vector3[] sourceVertices = source.vertices;
            List<Vector3> vertices = new List<Vector3>();
            List<int> triangles = new List<int>(indices.Count);
            Dictionary<int, int> remap = new Dictionary<int, int>();
            for (int i = 0; i < indices.Count; i += 1)
            {
                int sourceIndex = indices[i];
                if (sourceIndex < 0 || sourceIndex >= sourceVertices.Length) return null;
                if (!remap.TryGetValue(sourceIndex, out int localIndex))
                {
                    Vector3 worldVertex = sourceTransform.TransformPoint(sourceVertices[sourceIndex]);
                    localIndex = vertices.Count;
                    remap.Add(sourceIndex, localIndex);
                    vertices.Add(collisionRoot.InverseTransformPoint(worldVertex));
                }
                triangles.Add(localIndex);
            }

            Mesh mesh = new Mesh { name = name };
            if (vertices.Count > 65535) mesh.indexFormat = UnityEngine.Rendering.IndexFormat.UInt32;
            mesh.SetVertices(vertices);
            mesh.SetTriangles(triangles, 0, true);
            mesh.RecalculateBounds();
            return mesh;
        }

        private static CollisionGroup Classify(string materialName)
        {
            string value = materialName.ToLowerInvariant();
            if (value.Contains("top2") || value.Contains("sky") || value.Contains("dome"))
                return CollisionGroup.None;
            if (value.Contains("barrier") || value.Contains("armco") || value.Contains("wall")
                || value.Contains("fence") || value.Contains("tyreswall"))
                return CollisionGroup.Barrier;
            if (value.Contains("kerb") || value.Contains("curb") || value.Contains("rumble"))
                return CollisionGroup.Kerb;
            if (value.Contains("grass"))
                return CollisionGroup.Grass;
            if (value.Contains("gravel") || value.Contains("stone"))
                return CollisionGroup.Gravel;
            if (value.Contains("sand") || value.Contains("runoff"))
                return CollisionGroup.Runoff;
            // Monza's supplied GLB uses the compact "apsh-*" material
            // prefix for asphalt (the letters are transposed). Treat it as
            // road surface or the real start/finish has no collider.
            if (value.Contains("asphalt") || value.Contains("asph") || value.Contains("apsh")
                || value.Contains("groove"))
                return CollisionGroup.Track;
            return CollisionGroup.None;
        }

        private static GridlineSurface ToSurface(CollisionGroup group)
        {
            switch (group)
            {
                case CollisionGroup.Kerb: return GridlineSurface.Kerb;
                case CollisionGroup.Grass: return GridlineSurface.Grass;
                case CollisionGroup.Runoff: return GridlineSurface.Runoff;
                case CollisionGroup.Gravel: return GridlineSurface.Gravel;
                case CollisionGroup.Barrier: return GridlineSurface.Barrier;
                default: return GridlineSurface.Track;
            }
        }
    }
}
