import numpy as np
from itertools import permutations
import time


def flowshop_schedule(job_order, durations, releases):
    """
    Compute a flow shop schedule for a given job order.
    Each job must go through M1 → M2 → M3 in order.
    A machine can only process one job at a time.
    A job's task on machine k+1 can only start after its task on machine k finishes.

    Uses a completion time matrix C[j][m] where:
      C[j][m] = max(C[j][m-1], C[j-1][m]) + duration[j][m]
    """
    n_jobs = len(job_order)
    n_machines = durations.shape[1]

    # C[j][m] = completion time of j-th job in sequence on machine m
    C = np.zeros((n_jobs, n_machines), dtype=np.float64)
    S = np.zeros((n_jobs, n_machines), dtype=np.float64)
    schedule = []

    for j_pos, ji in enumerate(job_order):
        for mi in range(n_machines):
            d = float(durations[ji, mi])
            prev_machine = C[j_pos, mi - 1] if mi > 0 else float(releases[ji])
            prev_job = C[j_pos - 1, mi] if j_pos > 0 else 0.0
            start = max(prev_machine, prev_job)
            if mi == 0:
                start = max(start, float(releases[ji]))
            end = start + d
            C[j_pos, mi] = end
            S[j_pos, mi] = start
            schedule.append({
                "job": int(ji),
                "machine": int(mi),
                "start": start,
                "end": end,
                "duration": d,
            })

    makespan = float(C[n_jobs - 1, n_machines - 1])
    return schedule, makespan


def flowshop_makespan(job_order, durations, releases):
    """Fast makespan-only computation."""
    n_jobs = len(job_order)
    n_machines = durations.shape[1]
    C = np.zeros((n_jobs, n_machines), dtype=np.float64)

    for j_pos, ji in enumerate(job_order):
        for mi in range(n_machines):
            prev_machine = C[j_pos, mi - 1] if mi > 0 else float(releases[ji])
            prev_job = C[j_pos - 1, mi] if j_pos > 0 else 0.0
            start = max(prev_machine, prev_job)
            if mi == 0:
                start = max(start, float(releases[ji]))
            C[j_pos, mi] = start + float(durations[ji, mi])

    return float(C[n_jobs - 1, n_machines - 1])


def solve_flowshop(jobs_data):
    """
    Iterative solver that mimics SAT/SMT behavior:
    - Starts with an initial solution
    - Progressively tightens the upper bound
    - Records each improvement (like "Found value: 28... 22... 21")
    - Returns all iterations + final optimal

    jobs_data: list of dicts with 'id', 'release', 'tasks' (list of {m, d})
    """
    t0 = time.perf_counter()

    n_jobs = len(jobs_data)
    n_machines = max(t["m"] for j in jobs_data for t in j["tasks"]) + 1

    # Build numpy arrays
    durations = np.zeros((n_jobs, n_machines), dtype=np.float64)
    releases = np.zeros(n_jobs, dtype=np.float64)

    for i, job in enumerate(jobs_data):
        releases[i] = job["release"]
        for task in job["tasks"]:
            durations[i, task["m"]] = task["d"]

    # Phase 1: NEH heuristic for initial good solution
    total_proc = durations.sum(axis=1)
    sorted_jobs = np.argsort(-total_proc).tolist()

    best_order = [sorted_jobs[0]]
    for j in sorted_jobs[1:]:
        best_ms = float("inf")
        best_pos = 0
        for pos in range(len(best_order) + 1):
            candidate = best_order[:pos] + [j] + best_order[pos:]
            ms = flowshop_makespan(candidate, durations, releases)
            if ms < best_ms:
                best_ms = ms
                best_pos = pos
        best_order = best_order[:best_pos] + [j] + best_order[best_pos:]

    neh_makespan = flowshop_makespan(best_order, durations, releases)
    iterations = [{
        "iteration": 1,
        "method": "NEH heuristic",
        "order": [int(x) for x in best_order],
        "makespan": neh_makespan,
        "time_ms": round((time.perf_counter() - t0) * 1000, 2),
    }]

    global_best_order = list(best_order)
    global_best_ms = neh_makespan

    # Phase 2: Local search — pairwise swap improvement
    improved = True
    iteration = 2
    while improved:
        improved = False
        for i in range(n_jobs - 1):
            for j_idx in range(i + 1, n_jobs):
                candidate = list(global_best_order)
                candidate[i], candidate[j_idx] = candidate[j_idx], candidate[i]
                ms = flowshop_makespan(candidate, durations, releases)
                if ms < global_best_ms:
                    global_best_ms = ms
                    global_best_order = candidate
                    improved = True
                    iterations.append({
                        "iteration": iteration,
                        "method": "Pairwise swap",
                        "order": [int(x) for x in global_best_order],
                        "makespan": global_best_ms,
                        "time_ms": round((time.perf_counter() - t0) * 1000, 2),
                    })
                    iteration += 1

    # Phase 3: Insertion neighborhood
    improved = True
    while improved:
        improved = False
        for i in range(n_jobs):
            job = global_best_order[i]
            remaining = global_best_order[:i] + global_best_order[i+1:]
            for pos in range(n_jobs):
                if pos == i:
                    continue
                candidate = remaining[:pos] + [job] + remaining[pos:]
                ms = flowshop_makespan(candidate, durations, releases)
                if ms < global_best_ms:
                    global_best_ms = ms
                    global_best_order = candidate
                    improved = True
                    iterations.append({
                        "iteration": iteration,
                        "method": "Insertion",
                        "order": [int(x) for x in global_best_order],
                        "makespan": global_best_ms,
                        "time_ms": round((time.perf_counter() - t0) * 1000, 2),
                    })
                    iteration += 1

    # Phase 4: Exhaustive verification for small problems (n <= 8)
    if n_jobs <= 8:
        for perm in permutations(range(n_jobs)):
            ms = flowshop_makespan(list(perm), durations, releases)
            if ms < global_best_ms:
                global_best_ms = ms
                global_best_order = list(perm)
                iterations.append({
                    "iteration": iteration,
                    "method": "Exhaustive verification",
                    "order": [int(x) for x in global_best_order],
                    "makespan": global_best_ms,
                    "time_ms": round((time.perf_counter() - t0) * 1000, 2),
                })
                iteration += 1

    # Build final schedule
    final_schedule, final_makespan = flowshop_schedule(global_best_order, durations, releases)

    total_time = round((time.perf_counter() - t0) * 1000, 2)

    return {
        "optimal_order": [int(x) for x in global_best_order],
        "optimal_makespan": final_makespan,
        "schedule": final_schedule,
        "iterations": iterations,
        "total_time_ms": total_time,
        "n_jobs": n_jobs,
        "n_machines": n_machines,
        "method": "NEH + Local Search + Exhaustive verification",
    }
