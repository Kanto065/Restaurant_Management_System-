namespace Platform.Application.Delivery;

/// <summary>Where a named area really is, e.g. from OpenStreetMap or Ordnance Survey. Rings are
/// read with the even-odd rule, like zone shapes.</summary>
public record AreaReference(string Label, string Source, IReadOnlyList<IReadOnlyList<GeoPoint>> Rings);

/// <summary>A zone (or two zones sharing a name at two prices) to draw from an area reference.
/// For two zones, ZoneIds is ordered cheapest first: it gets the half nearer the restaurant.</summary>
public record ZoneDrawTarget(AreaReference Reference, IReadOnlyList<Guid> ZoneIds);

/// <summary>
/// Draws zone shapes from named-area references. A grid of small squares is laid over the
/// delivery area; each square goes to the most specific area it lies in (Port Tennant beats the
/// larger official St Thomas it sits inside), squares in no area go to the nearest area within
/// <c>fillMetres</c>, and squares inside zones that are being kept are left alone. Each zone's
/// squares are then traced into outlines. Because every square has exactly one owner,
/// neighbouring shapes share their borders - no gaps, no overlaps (bar smoothing slivers).
/// </summary>
public static class ZoneAreaBuilder
{
    private const int Reserved = -1;
    private const int Unassigned = -2;

    public static Dictionary<Guid, List<IReadOnlyList<GeoPoint>>> Build(
        GeoPoint restaurant, double maxMiles, IReadOnlyList<ZoneDrawTarget> targets,
        IReadOnlyCollection<DeliveryZoneShape> keptZones,
        double cellMetres = 40, double fillMetres = 300, double smoothMetres = 12)
    {
        var result = new Dictionary<Guid, List<IReadOnlyList<GeoPoint>>>();
        if (targets.Count == 0) return result;

        var proj = new LocalProjection(restaurant);
        var refs = targets.Select(t => new ProjectedArea(t.Reference.Rings.Select(r => r.Select(proj.ToXY).ToArray()).ToArray())).ToArray();
        var limit = maxMiles * 1609.344;

        // Grid over the references (plus the fill margin), cut to the delivery limit.
        double minX = Math.Max(-limit, refs.Min(r => r.MinX) - fillMetres), maxX = Math.Min(limit, refs.Max(r => r.MaxX) + fillMetres);
        double minY = Math.Max(-limit, refs.Min(r => r.MinY) - fillMetres), maxY = Math.Min(limit, refs.Max(r => r.MaxY) + fillMetres);
        if (maxX <= minX || maxY <= minY) return result;
        int cols = (int)Math.Ceiling((maxX - minX) / cellMetres), rows = (int)Math.Ceiling((maxY - minY) / cellMetres);

        // 1. Which target owns each square.
        var owner = new int[cols, rows];
        for (var cx = 0; cx < cols; cx++)
        for (var cy = 0; cy < rows; cy++)
        {
            var x = minX + (cx + 0.5) * cellMetres;
            var y = minY + (cy + 0.5) * cellMetres;
            if (x * x + y * y > limit * limit) { owner[cx, cy] = Unassigned; continue; }
            var geo = proj.ToGeo(x, y);
            if (keptZones.Any(z => z.IsDrawn && DeliveryPricing.Contains(z.Rings, geo))) { owner[cx, cy] = Reserved; continue; }

            int best = Unassigned;
            double bestArea = double.MaxValue;
            for (var i = 0; i < refs.Length; i++)
                if (refs[i].Area < bestArea && refs[i].Contains(x, y)) { best = i; bestArea = refs[i].Area; }

            if (best == Unassigned && fillMetres > 0)
            {
                var bestDist = fillMetres;
                for (var i = 0; i < refs.Length; i++)
                {
                    var d = refs[i].DistanceTo(x, y, bestDist);
                    if (d < bestDist) { best = i; bestDist = d; }
                }
            }
            owner[cx, cy] = best;
        }

        // 2. Squares -> zones. A name at two prices is cut across the restaurant->area direction
        //    at its middle: the nearer half is the cheaper zone.
        var zoneOf = new Guid?[cols, rows];
        for (var t = 0; t < targets.Count; t++)
        {
            var cells = new List<(int X, int Y)>();
            for (var cx = 0; cx < cols; cx++)
            for (var cy = 0; cy < rows; cy++)
                if (owner[cx, cy] == t) cells.Add((cx, cy));
            if (cells.Count == 0) continue;

            var ids = targets[t].ZoneIds;
            if (ids.Count == 1)
            {
                foreach (var (cx, cy) in cells) zoneOf[cx, cy] = ids[0];
                continue;
            }

            double Cx(int cx) => minX + (cx + 0.5) * cellMetres;
            double Cy(int cy) => minY + (cy + 0.5) * cellMetres;
            var dirX = cells.Average(c => Cx(c.X));
            var dirY = cells.Average(c => Cy(c.Y));
            var len = Math.Sqrt(dirX * dirX + dirY * dirY);
            if (len < 1) { dirX = 1; dirY = 0; len = 1; }
            var along = cells.Select(c => (Cell: c, D: (Cx(c.X) * dirX + Cy(c.Y) * dirY) / len)).OrderBy(c => c.D).ToList();
            var half = along.Count / 2;
            for (var k = 0; k < along.Count; k++)
                zoneOf[along[k].Cell.X, along[k].Cell.Y] = k < half ? ids[0] : ids[^1];
        }

        // 3. Trace each zone's squares into rings.
        foreach (var id in targets.SelectMany(t => t.ZoneIds).Distinct())
        {
            var rings = Trace(zoneOf, id, cols, rows)
                .Select(loop => Smooth(loop, smoothMetres / cellMetres))
                .Where(loop => loop.Count >= 3 && Math.Abs(SignedArea(loop)) >= 2) // drop specks under 2 squares
                .Select(loop => (IReadOnlyList<GeoPoint>)loop.Select(p => proj.ToGeo(minX + p.X * cellMetres, minY + p.Y * cellMetres)).ToList())
                .ToList();
            if (rings.Count > 0) result[id] = rings;
        }
        return result;
    }

    /// <summary>For checking zones: finds the most specific reference containing a point (the
    /// smallest area wins) - the same rule the builder uses.</summary>
    public sealed class AreaIndex
    {
        private readonly LocalProjection _proj;
        private readonly ProjectedArea[] _areas;

        public AreaIndex(IReadOnlyList<AreaReference> references, GeoPoint origin)
        {
            _proj = new LocalProjection(origin);
            _areas = references.Select(r => new ProjectedArea(r.Rings.Select(ring => ring.Select(_proj.ToXY).ToArray()).ToArray())).ToArray();
        }

        /// <summary>Index of the most specific reference containing the point, or -1.</summary>
        public int MostSpecific(GeoPoint point)
        {
            var (x, y) = _proj.ToXY(point);
            int best = -1;
            var bestArea = double.MaxValue;
            for (var i = 0; i < _areas.Length; i++)
                if (_areas[i].Area < bestArea && _areas[i].Contains(x, y)) { best = i; bestArea = _areas[i].Area; }
            return best;
        }

        /// <summary>The corners of each reference's bounding box, for fetching postcodes inside it.</summary>
        public (GeoPoint SouthWest, GeoPoint NorthEast) Bounds(int i) =>
            (_proj.ToGeo(_areas[i].MinX, _areas[i].MinY), _proj.ToGeo(_areas[i].MaxX, _areas[i].MaxY));
    }

    // ---- tracing: follow the edges between a zone's squares and everything else ----

    private readonly record struct Pt(double X, double Y);

    private static List<List<Pt>> Trace(Guid?[,] zoneOf, Guid id, int cols, int rows)
    {
        bool In(int x, int y) => x >= 0 && y >= 0 && x < cols && y < rows && zoneOf[x, y] == id;

        // Directed edges with the zone on the left (anticlockwise around each square).
        var outgoing = new Dictionary<(int, int), List<(int, int)>>();
        void Edge((int, int) from, (int, int) to)
        {
            if (!outgoing.TryGetValue(from, out var list)) outgoing[from] = list = [];
            list.Add(to);
        }
        for (var x = 0; x < cols; x++)
        for (var y = 0; y < rows; y++)
        {
            if (!In(x, y)) continue;
            if (!In(x, y - 1)) Edge((x, y), (x + 1, y));         // bottom
            if (!In(x + 1, y)) Edge((x + 1, y), (x + 1, y + 1)); // right
            if (!In(x, y + 1)) Edge((x + 1, y + 1), (x, y + 1)); // top
            if (!In(x - 1, y)) Edge((x, y + 1), (x, y));         // left
        }

        // Every corner has as many edges in as out, so following unused edges always closes a loop.
        var loops = new List<List<Pt>>();
        foreach (var start in outgoing.Keys.ToList())
        {
            while (outgoing.TryGetValue(start, out var fromStart) && fromStart.Count > 0)
            {
                var loop = new List<Pt>();
                var at = start;
                do
                {
                    loop.Add(new Pt(at.Item1, at.Item2));
                    var next = outgoing[at];
                    var to = next[^1];
                    next.RemoveAt(next.Count - 1);
                    at = to;
                } while (at != start);
                loops.Add(RemoveCollinear(loop));
            }
        }
        return loops;
    }

    private static List<Pt> RemoveCollinear(List<Pt> loop)
    {
        var kept = new List<Pt>();
        for (var i = 0; i < loop.Count; i++)
        {
            var prev = loop[(i - 1 + loop.Count) % loop.Count];
            var next = loop[(i + 1) % loop.Count];
            var cur = loop[i];
            if ((cur.X - prev.X) * (next.Y - cur.Y) - (cur.Y - prev.Y) * (next.X - cur.X) != 0) kept.Add(cur);
        }
        return kept;
    }

    /// <summary>Douglas-Peucker on a closed ring, to take the staircase off square edges.</summary>
    private static List<Pt> Smooth(List<Pt> loop, double tolerance)
    {
        if (loop.Count < 8 || tolerance <= 0) return loop;
        // Split the ring at its two farthest-apart corners and simplify each half.
        var far = 0;
        var farDist = 0.0;
        for (var i = 1; i < loop.Count; i++)
        {
            var d = Math.Pow(loop[i].X - loop[0].X, 2) + Math.Pow(loop[i].Y - loop[0].Y, 2);
            if (d > farDist) { farDist = d; far = i; }
        }
        var first = Simplify(loop.GetRange(0, far + 1), tolerance);
        var second = Simplify([.. loop.GetRange(far, loop.Count - far), loop[0]], tolerance);
        return [.. first.Take(first.Count - 1), .. second.Take(second.Count - 1)];
    }

    private static List<Pt> Simplify(List<Pt> line, double tolerance)
    {
        if (line.Count < 3) return line;
        var keep = new bool[line.Count];
        keep[0] = keep[^1] = true;
        var stack = new Stack<(int A, int B)>();
        stack.Push((0, line.Count - 1));
        while (stack.Count > 0)
        {
            var (a, b) = stack.Pop();
            var worst = -1;
            var worstDist = tolerance;
            for (var i = a + 1; i < b; i++)
            {
                var d = SegmentDistance(line[i], line[a], line[b]);
                if (d > worstDist) { worstDist = d; worst = i; }
            }
            if (worst < 0) continue;
            keep[worst] = true;
            stack.Push((a, worst));
            stack.Push((worst, b));
        }
        return line.Where((_, i) => keep[i]).ToList();
    }

    private static double SegmentDistance(Pt p, Pt a, Pt b)
    {
        var dx = b.X - a.X;
        var dy = b.Y - a.Y;
        var lenSq = dx * dx + dy * dy;
        var t = lenSq == 0 ? 0 : Math.Clamp(((p.X - a.X) * dx + (p.Y - a.Y) * dy) / lenSq, 0, 1);
        return Math.Sqrt(Math.Pow(p.X - (a.X + t * dx), 2) + Math.Pow(p.Y - (a.Y + t * dy), 2));
    }

    private static double SignedArea(List<Pt> loop)
    {
        double s = 0;
        for (int i = 0, j = loop.Count - 1; i < loop.Count; j = i++)
            s += (loop[j].X + loop[i].X) * (loop[j].Y - loop[i].Y);
        return s / 2;
    }

    // ---- flat metric coordinates around the restaurant (fine at town scale) ----

    private sealed class LocalProjection(GeoPoint origin)
    {
        private readonly double _kx = 111_320 * Math.Cos(origin.Latitude * Math.PI / 180);
        private const double Ky = 110_574;

        public (double X, double Y) ToXY(GeoPoint p) => ((p.Longitude - origin.Longitude) * _kx, (p.Latitude - origin.Latitude) * Ky);
        public GeoPoint ToGeo(double x, double y) => new(origin.Latitude + y / Ky, origin.Longitude + x / _kx);
    }

    private sealed class ProjectedArea
    {
        private readonly (double X, double Y)[][] _rings;
        public double MinX { get; }
        public double MaxX { get; }
        public double MinY { get; }
        public double MaxY { get; }
        public double Area { get; }

        public ProjectedArea((double X, double Y)[][] rings)
        {
            _rings = rings.Where(r => r.Length >= 3).ToArray();
            var all = _rings.SelectMany(r => r).ToArray();
            MinX = all.Length > 0 ? all.Min(p => p.X) : 0;
            MaxX = all.Length > 0 ? all.Max(p => p.X) : 0;
            MinY = all.Length > 0 ? all.Min(p => p.Y) : 0;
            MaxY = all.Length > 0 ? all.Max(p => p.Y) : 0;
            // Even-odd: outer rings add, rings inside others (holes) subtract - |sum| is close enough for "smallest wins".
            Area = Math.Abs(_rings.Sum(r =>
            {
                double s = 0;
                for (int i = 0, j = r.Length - 1; i < r.Length; j = i++) s += (r[j].X + r[i].X) * (r[j].Y - r[i].Y);
                return s / 2;
            }));
        }

        public bool Contains(double x, double y)
        {
            if (x < MinX || x > MaxX || y < MinY || y > MaxY) return false;
            var inside = false;
            foreach (var r in _rings)
            {
                var ringIn = false;
                for (int i = 0, j = r.Length - 1; i < r.Length; j = i++)
                    if ((r[i].Y > y) != (r[j].Y > y) && x < (r[j].X - r[i].X) * (y - r[i].Y) / (r[j].Y - r[i].Y) + r[i].X)
                        ringIn = !ringIn;
                if (ringIn) inside = !inside;
            }
            return inside;
        }

        /// <summary>Distance to the nearest edge, or <paramref name="cutoff"/> when it's clearly further.</summary>
        public double DistanceTo(double x, double y, double cutoff)
        {
            if (x < MinX - cutoff || x > MaxX + cutoff || y < MinY - cutoff || y > MaxY + cutoff) return cutoff;
            var best = cutoff;
            foreach (var r in _rings)
                for (int i = 0, j = r.Length - 1; i < r.Length; j = i++)
                {
                    var d = SegmentDistance(new Pt(x, y), new Pt(r[j].X, r[j].Y), new Pt(r[i].X, r[i].Y));
                    if (d < best) best = d;
                }
            return best;
        }
    }
}
