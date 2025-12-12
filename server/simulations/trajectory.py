import math

class Trajectory:
    def __init__(self, x0, y0, vx, vy):
        self.x = x0
        self.y = y0
        self.vx = vx
        self.vy = vy
        self.points = []

    def step(self, dt):
        self.x += self.vx * dt
        self.y += self.vy * dt
        self.points.append((self.x, self.y))

    def to_dict(self):
        return {
            "x": [p[0] for p in self.points],
            "y": [p[1] for p in self.points]
        }


def build_random_trajectory(r, angle, speed):
    x0 = r * math.cos(angle)
    y0 = r * math.sin(angle)

    vx = speed * math.cos(angle)
    vy = speed * math.sin(angle)

    return Trajectory(x0, y0, vx, vy)
