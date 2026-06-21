from solver import solve_flowshop

jobs = [
    {"id": "J1", "release": 0, "tasks": [{"m": 0, "d": 2}, {"m": 1, "d": 5}, {"m": 2, "d": 6}]},
    {"id": "J2", "release": 9, "tasks": [{"m": 0, "d": 1}, {"m": 1, "d": 5}, {"m": 2, "d": 7}]},
    {"id": "J3", "release": 2, "tasks": [{"m": 0, "d": 1}, {"m": 1, "d": 4}, {"m": 2, "d": 1}]},
    {"id": "J4", "release": 7, "tasks": [{"m": 0, "d": 3}, {"m": 1, "d": 4}, {"m": 2, "d": 7}]},
]

r = solve_flowshop(jobs)
print(f"Makespan: {r['optimal_makespan']}")
print(f"Order: {[jobs[i]['id'] for i in r['optimal_order']]}")
print(f"Time: {r['total_time_ms']}ms")
print(f"Iterations:")
for it in r["iterations"]:
    order_str = " -> ".join(jobs[i]["id"] for i in it["order"])
    print(f"  #{it['iteration']:2d}  {it['method']:25s}  makespan={it['makespan']:5.1f}  {order_str}  ({it['time_ms']}ms)")
