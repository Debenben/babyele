from pybricks.hubs import InventorHub
from pybricks.messaging import BLERadio
from pybricks.parameters import Color, Button
from pybricks.tools import wait, StopWatch, Matrix

from umath import floor, acos, pi, sqrt, sin, cos, asin, atan2, copysign
from ustruct import unpack_from, pack, pack_into
from urandom import randint

_HUBID = const(0)

_CMD_SUBCMD = const(0)
_CMD_SPEED = const(1)
_CMD_ANGLE = const(2)
_CMD_DATA = const(3)

_SUBCMD_WAIT = const(0)
_SUBCMD_SHUTDOWN = const(1)
_SUBCMD_STORE = const(2)
_SUBCMD_EXECUTE = const(3)
_SUBCMD_RESET = const(4)

_CMD_SHUTDOWN_PACK = [pack('<3B11h',_CMD_SUBCMD, _SUBCMD_SHUTDOWN,0,0,0, 0,0,0, 0,0,0, 0,0,0)]

_BUTTON_IDLE = const(0)
_BUTTON_ACTIVE = const(1)
_BUTTON_SELECT = const(2)
_BUTTON_INACTIVE = const(3)

_SELECT_RETURN = const(7)
_SELECT_SHUTDOWN = const(8)

_LEG_LENGTH_TOP = const(193.5)
_LEG_LENGTH_BOTTOM = const(244.0)
_LEG_SEPARATION_WIDTH = const(288.0)
_LEG_SEPARATION_LENGTH = const(392.0)
_LEG_MOUNT_HEIGHT = const(36.0)
_LEG_MOUNT_WIDTH = const(76.0)
_LEG_PISTON_HEIGHT = const(96.0)
_LEG_PISTON_WIDTH = const(144.0)
_LEG_PISTON_LENGTH = const(200.0)
_LEG_FOOT_DIAMETER = const(56.0)

_LEG_TOP_HUB_ANGLE = const(0.1243549945)

_MOUNT_MOTOR_RANGE = const(400)
_MOUNT_MOTOR_MAX_SPEED = const(882)
_TOP_MOTOR_RANGE = const(-35000)
_TOP_MOTOR_MAX_SPEED = const(756)
_BOTTOM_MOTOR_RANGE = const(29531)
_BOTTOM_MOTOR_MAX_SPEED = const(756)

_LEDICONS = [
Matrix(
    [
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [  0,  50, 100,  50,   0],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
    ]
),
Matrix(
    [
        [100,  50,   0,   0,   0],
        [ 80,  50,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
    ]
),
Matrix(
    [
        [  0,   0,   0,  50, 100],
        [  0,   0,   0,  50,  80],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
    ]
),
Matrix(
    [
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [ 80,  50,   0,   0,   0],
        [100,  50,   0,   0,   0],
    ]
),
Matrix(
    [
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,  50,  80],
        [  0,   0,   0,  50, 100],
    ]
),
Matrix(
    [
        [  0,  30,   0,  30,   0],
        [  0,  50, 100,  50,   0],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
    ]
),
Matrix(
    [
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [  0,  50, 100,  50,   0],
        [  0,  30,   0,  30,   0],
    ]
),
Matrix(
    [
        [  0,  60,  80,  60,   0],
        [ 60, 100, 100, 100,  60],
        [ 80, 100, 100, 100,  80],
        [ 60, 100, 100, 100,  60],
        [  0,  60,  80,  60,   0],
    ]
),
Matrix(
    [
        [  0,  60,  80,  60,   0],
        [ 60,   0,   0,   0,  60],
        [ 80,   0,   0,   0,  80],
        [ 60,   0, 100,   0,  60],
        [  0,  60, 100,  60,   0],
    ]
)]

loopCounter = 0
commandCounter = 0
buttonMode = _BUTTON_INACTIVE
selection = _SELECT_RETURN
selectedSpeed = 0
startMovePositions = None
bendForward = [False, True, False, True]
hubSensorData = [None, None, None, None, None, None, None]
hubTimestamps = [-100000, -100000, -100000, -100000, -100000, -100000, -100000]
hubChecksums = [0, 0, 0, 0, 0, 0, 0]


hub = InventorHub()
hub.system.set_stop_button(None)
hub.speaker.volume(10)
radio = BLERadio(observe_channels=[0,1,2,3,4,5,6], broadcast_channel=_HUBID)
time = StopWatch()


def cosLaw(rSide, lSide, angle):
    return sqrt(abs(rSide**2 + lSide**2 - 2*rSide*lSide*cos(angle)))


def invCosLaw(rSide, lSide, oSide):
    cosVal = (rSide*rSide + lSide*lSide - oSide*oSide)/(2*rSide*lSide)
    if cosVal > 1.0:
        cosVal = 1.0
    elif cosVal < -1.0:
        cosVal = -1.0
    return acos(cosVal)


def mat3_T(A):
    return [
        [A[0][0], A[1][0], A[2][0]],
        [A[0][1], A[1][1], A[2][1]],
        [A[0][2], A[1][2], A[2][2]]
    ]


def mat3_mul(A, B):
    C = [[0,0,0],[0,0,0],[0,0,0]]
    for r in range(3):
        for c in range(3):
            C[r][c] = (
                A[r][0]*B[0][c] +
                A[r][1]*B[1][c] +
                A[r][2]*B[2][c]
            )
    return C


def mat3_det(M):
    return (
        M[0][0]*(M[1][1]*M[2][2] - M[1][2]*M[2][1]) -
        M[0][1]*(M[1][0]*M[2][2] - M[1][2]*M[2][0]) +
        M[0][2]*(M[1][0]*M[2][1] - M[1][1]*M[2][0])
    )


def vec3_rotate(v, R):
    x = v[0]
    y = v[1]
    z = v[2]
    return [
        R[0][0]*x + R[0][1]*y + R[0][2]*z,
        R[1][0]*x + R[1][1]*y + R[1][2]*z,
        R[2][0]*x + R[2][1]*y + R[2][2]*z
    ]


def quat_from_mat3(m):
    trace = m[0][0] + m[1][1] + m[2][2]
    if trace > 0:
        s = sqrt(trace + 1.0) * 2
        w = 0.25 * s
        x = (m[2][1] - m[1][2]) / s
        y = (m[0][2] - m[2][0]) / s
        z = (m[1][0] - m[0][1]) / s
        return [x, y, z, w]
    if m[0][0] > m[1][1] and m[0][0] > m[2][2]:
        s = sqrt(1.0 + m[0][0] - m[1][1] - m[2][2]) * 2
        x = 0.25 * s
        y = (m[0][1] + m[1][0]) / s
        z = (m[0][2] + m[2][0]) / s
        w = (m[2][1] - m[1][2]) / s
        return [x, y, z, w]
    if m[1][1] > m[2][2]:
        s = sqrt(1.0 + m[1][1] - m[0][0] - m[2][2]) * 2
        x = (m[0][1] + m[1][0]) / s
        y = 0.25 * s
        z = (m[1][2] + m[2][1]) / s
        w = (m[0][2] - m[2][0]) / s
        return [x, y, z, w]
    s = sqrt(1.0 + m[2][2] - m[0][0] - m[1][1]) * 2
    x = (m[0][2] + m[2][0]) / s
    y = (m[1][2] + m[2][1]) / s
    z = 0.25 * s
    w = (m[1][0] - m[0][1]) / s
    return [x, y, z, w]


def euler_from_quat(q):
    x, y, z, w = q
    siny = 2 * (w*y + x*z)
    cosy = 1 - 2 * (y*y + z*z)
    yaw = atan2(siny, cosy)
    sinp = 2 * (w*x - y*z)
    if abs(sinp) >= 1:
        pitch = copysign(pi/2, sinp)
    else:
        pitch = asin(sinp)
    sinr = 2 * (w*z + x*y)
    cosr = 1 - 2 * (z*z + x*x)
    roll = atan2(sinr, cosr)
    return [pitch*180/pi, yaw*180/pi, roll*180/pi]


def mat3_from_euler(pitch, yaw, roll):
    p = pitch*pi/180.0
    y = yaw*pi/180.0
    r = roll*pi/180.0
    sp, cp = sin(p), cos(p)
    sy, cy = sin(y), cos(y)
    sr, cr = sin(r), cos(r)
    m = [
        [
            cy*cr + sy*sp*sr,
            -cy*sr + sy*sp*cr,
            sy*cp
        ],
        [
            cp*sr,
            cp*cr,
            -sp
        ],
        [
            -sy*cr + cy*sp*sr,
            sy*sr + cy*sp*cr,
            cy*cp
        ]
    ]
    return m


def svd3x3(A):
    M = [[A[i][j] for j in range(3)] for i in range(3)]
    U_T = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]
    for _ in range(30):
        converged = True
        for p in range(3):
            for q in range(p+1, 3):
                a = sum(M[p][k]**2 for k in range(3))
                b = sum(M[q][k]**2 for k in range(3))
                c = sum(M[p][k]*M[q][k] for k in range(3))
                if abs(c) < 1e-12:
                    if a < b:
                        cs, sn = 0.0, 1.0
                    else:
                        continue
                else:
                    converged = False
                    tau = (b - a) / (2.0*c)
                    t = 1.0 / (abs(tau) + sqrt(1.0 + tau*tau))
                    if tau < 0:
                        t = -t
                    cs = 1.0 / sqrt(1.0 + t*t)
                    sn = t*cs
                for k in range(3):
                    mpk, mqk = M[p][k], M[q][k]
                    M[p][k] = cs*mpk - sn*mqk
                    M[q][k] = sn*mpk + cs*mqk
                for k in range(3):
                    upk, uqk = U_T[p][k], U_T[q][k]
                    U_T[p][k] = cs*upk - sn*uqk
                    U_T[q][k] = sn*upk + cs*uqk
        if converged:
            break
    S = [0.0, 0.0, 0.0]
    for i in range(3):
        S[i] = sqrt(sum(M[i][k]**2 for k in range(3)))
    V_T = [[0.0]*3 for _ in range(3)]
    for i in range(3):
        if S[i] > 1e-12:
            for k in range(3):
                V_T[i][k] = M[i][k] / S[i]
    indices = [0, 1, 2]
    indices.sort(key=lambda x: S[x], reverse=True)
    S_sorted = [S[i] for i in indices]
    U_T_sorted = [U_T[i] for i in indices]
    V_T_sorted = [V_T[i] for i in indices]
    for mat in (U_T_sorted, V_T_sorted):
        for i in range(3):
            norm = sqrt(sum(x**2 for x in mat[i]))
            if norm < 1e-6:
                for unit in [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]:
                    v = unit[:]
                    for j in range(i):
                        dot = sum(mat[j][k]*unit[k] for k in range(3))
                        for k in range(3):
                            v[k] -= dot*mat[j][k]
                    v_norm = sqrt(sum(x**2 for x in v))
                    if v_norm > 1e-4:
                        mat[i] = [x / v_norm for x in v]
                        break
            else:
                mat[i] = [x / norm for x in mat[i]]
    U = [[U_T_sorted[j][i] for j in range(3)] for i in range(3)]
    V = [[V_T_sorted[j][i] for j in range(3)] for i in range(3)]
    return (U, V)


defaultLegPositions = [0.5*_LEG_SEPARATION_LENGTH, -_LEG_MOUNT_HEIGHT,  (0.5*_LEG_SEPARATION_WIDTH - _LEG_MOUNT_WIDTH),
                       0.5*_LEG_SEPARATION_LENGTH, -_LEG_MOUNT_HEIGHT, -(0.5*_LEG_SEPARATION_WIDTH - _LEG_MOUNT_WIDTH),
                      -0.5*_LEG_SEPARATION_LENGTH, -_LEG_MOUNT_HEIGHT,  (0.5*_LEG_SEPARATION_WIDTH - _LEG_MOUNT_WIDTH),
                      -0.5*_LEG_SEPARATION_LENGTH, -_LEG_MOUNT_HEIGHT, -(0.5*_LEG_SEPARATION_WIDTH - _LEG_MOUNT_WIDTH)]


mountAngleOffset = invCosLaw(_LEG_PISTON_HEIGHT, _LEG_PISTON_WIDTH, _LEG_PISTON_LENGTH)


def getMotorAngles():
    _unpack = unpack_from
    _angles = [None]*12
    data = hubSensorData[1]
    if data is not None:
        _angles[2] = _unpack('<h', data, 8)[0]*10
    data = hubSensorData[2]
    if data is not None:
        _angles[5] = _unpack('<h', data, 8)[0]*10
    data = hubSensorData[3]
    if data is not None:
        _angles[8] = _unpack('<h', data, 8)[0]*10
    data = hubSensorData[4]
    if data is not None:
        _angles[11] = _unpack('<h', data, 8)[0]*10
    data = hubSensorData[5]
    if data is not None:
        _angles[0] = _unpack('<h', data, 8)[0]*10
        _angles[1] = _unpack('<h', data, 10)[0]*10
        _angles[3] = _unpack('<h', data, 12)[0]*10
        _angles[4] = _unpack('<h', data, 14)[0]*10
    data = hubSensorData[6]
    if data is not None:
        _angles[6] = _unpack('<h', data, 8)[0]*10
        _angles[7] = _unpack('<h', data, 10)[0]*10
        _angles[9] = _unpack('<h', data, 12)[0]*10
        _angles[10] = _unpack('<h', data, 14)[0]*10
    return _angles


def getMotorSpeeds():
    _unpack = unpack_from
    _speeds = [None]*12
    data = hubSensorData[1]
    if data is not None:
        _speeds[2] = _unpack('<h', data, 10)[0]
    data = hubSensorData[2]
    if data is not None:
        _speeds[5] = _unpack('<h', data, 10)[0]
    data = hubSensorData[3]
    if data is not None:
        _speeds[8] = _unpack('<h', data, 10)[0]
    data = hubSensorData[4]
    if data is not None:
        _speeds[11] = _unpack('<h', data, 10)[0]
    data = hubSensorData[5]
    if data is not None:
        _speeds[0] = _unpack('<h', data, 16)[0]
        _speeds[1] = _unpack('<h', data, 18)[0]
        _speeds[3] = _unpack('<h', data, 20)[0]
        _speeds[4] = _unpack('<h', data, 22)[0]
    data = hubSensorData[6]
    if data is not None:
        _speeds[6] = _unpack('<h', data, 16)[0]
        _speeds[7] = _unpack('<h', data, 18)[0]
        _speeds[9] = _unpack('<h', data, 20)[0]
        _speeds[10] = _unpack('<h', data, 22)[0]
    return _speeds


def getEvolvedMotorAngles():
    _unpack = unpack_from
    _hub_data = hubSensorData
    _hub_times = hubTimestamps
    now = time.time()
    _angles = [None]*12
    data = _hub_data[1]
    if data is not None:
        dt = min(2000, now - _hub_times[1])*0.001
        base, speed = _unpack('<hh', data, 8)
        _angles[2] = base*10 + int(speed*dt)
    data = _hub_data[2]
    if data is not None:
        dt = min(2000, now - _hub_times[2])*0.001
        base, speed = _unpack('<hh', data, 8)
        _angles[5] = base*10 + int(speed*dt)
    data = _hub_data[3]
    if data is not None:
        dt = min(2000, now - _hub_times[3])*0.001
        base, speed = _unpack('<hh', data, 8)
        _angles[8] = base*10 + int(speed*dt)
    data = _hub_data[4]
    if data is not None:
        dt = min(2000, now - _hub_times[4])*0.001
        base, speed = _unpack('<hh', data, 8)
        _angles[11] = base*10 + int(speed*dt)
    data = _hub_data[5]
    if data is not None:
        dt = min(2000, now - _hub_times[5])*0.001
        b0, b1, b3, b4, s0, s1, s3, s4 = _unpack('<hhhhhhhh', data, 8)
        _angles[0] = b0*10 + int(s0*dt)
        _angles[1] = b1*10 + int(s1*dt)
        _angles[3] = b3*10 + int(s3*dt)
        _angles[4] = b4*10 + int(s4*dt)
    data = _hub_data[6]
    if data is not None:
        dt = min(2000, now - _hub_times[6])*0.001
        b6, b7, b9, b10, s6, s7, s9, s10 = _unpack('<hhhhhhhh', data, 8)
        _angles[6] = b6*10 + int(s6*dt)
        _angles[7] = b7*10 + int(s7*dt)
        _angles[9] = b9*10 + int(s9*dt)
        _angles[10] = b10*10 + int(s10*dt)
    return _angles


def legAnglesFromMotorAngles(motorAngles):
    _topFactor = pi/_TOP_MOTOR_RANGE
    _bottomFactor = pi/_BOTTOM_MOTOR_RANGE
    for i in range(4):
        val = motorAngles[3*i]
        if val is not None:
            pistonLength = _LEG_PISTON_LENGTH + val/_MOUNT_MOTOR_RANGE
            motorAngles[3*i] = invCosLaw(_LEG_PISTON_HEIGHT, _LEG_PISTON_WIDTH, pistonLength) - mountAngleOffset
        val = motorAngles[3*i + 1]
        if val is not None:
            motorAngles[3*i + 1] = val*_topFactor
        val = motorAngles[3*i + 2]
        if val is not None:
            motorAngles[3*i + 2] = val*_bottomFactor
    return motorAngles


def motorAnglesFromLegAngles(legAngles):
    for i in range(4):
        if legAngles[3*i] is not None:
            pistonLength = cosLaw(_LEG_PISTON_HEIGHT, _LEG_PISTON_WIDTH, legAngles[3*i] + mountAngleOffset)
            legAngles[3*i] = (pistonLength - _LEG_PISTON_LENGTH)*_MOUNT_MOTOR_RANGE
        if legAngles[3*i + 1] is not None:
            legAngles[3*i + 1] *= _TOP_MOTOR_RANGE/pi
        if legAngles[3*i + 2] is not None:
            legAngles[3*i + 2] *= _BOTTOM_MOTOR_RANGE/pi
    return legAngles


def legPositionsFromMotorAngles(motorAngles):
    vec = legAnglesFromMotorAngles(motorAngles)
    _legMountWidthSquared = _LEG_MOUNT_WIDTH*_LEG_MOUNT_WIDTH
    for i in range(4):
        mAngle = vec[3*i]
        tAngle = vec[3*i + 1]
        bAngle = vec[3*i + 2]
        if mAngle is not None and tAngle is not None and bAngle is not None:
            bAngle = bAngle + tAngle
            forward = _LEG_LENGTH_TOP*sin(tAngle) + _LEG_LENGTH_BOTTOM*sin(bAngle)
            mHeight = _LEG_LENGTH_TOP*cos(tAngle) + _LEG_LENGTH_BOTTOM*cos(bAngle) - _LEG_MOUNT_HEIGHT
            mAngle = mAngle + atan2(_LEG_MOUNT_WIDTH, mHeight)
            mLength = sqrt(mHeight*mHeight + _legMountWidthSquared)
            vec[3*i] = forward
            vec[3*i + 1] = -mLength*cos(mAngle) #height
            vec[3*i + 2] = mLength*sin(mAngle) #sideways
    for i in (0, 5, 6, 11):
        val = vec[i]
        if val is not None:
            vec[i] = -1*val
    _defPos = defaultLegPositions
    for i in range(12):
        val = vec[i]
        if val is not None:
            vec[i] = val + _defPos[i]
    return vec


def motorAnglesFromLegPositions(positions, bendForward):
    for i in range(12):
        if positions[i] is None:
            return [None]*12
        positions[i] -= defaultLegPositions[i]
    positions[0] *= -1
    positions[5] *= -1
    positions[6] *= -1
    positions[11] *= -1
    for i in range(4):
        mAngle = atan2(positions[3*i + 2], -positions[3*i + 1])
        mLength = -positions[3*i + 1]/cos(mAngle);
        mHeight = sqrt(abs(mLength**2 - _LEG_MOUNT_WIDTH**2))
        mountAngle = mAngle - atan2(_LEG_MOUNT_WIDTH, mHeight)
        tbHeight = mHeight + _LEG_MOUNT_HEIGHT
        tbLength = sqrt(tbHeight**2 + positions[3*i]**2)
        phi = atan2(positions[3*i], tbHeight)
        alpha = invCosLaw(tbLength, _LEG_LENGTH_TOP, _LEG_LENGTH_BOTTOM)
        topAngle = phi + alpha
        bottomAngle = acos((_LEG_LENGTH_TOP/_LEG_LENGTH_BOTTOM)*cos(pi/2 - alpha)) - alpha - pi/2;
        if bendForward[i]:
            topAngle = phi - alpha
            bottomAngle *= -1
        positions[3*i] = mountAngle
        positions[3*i + 1] = topAngle
        positions[3*i + 2] = bottomAngle
    return motorAnglesFromLegAngles(positions)


def dogRotationFromLegPositions(legPositions):
    for v in legPositions:
        if v is None:
            return [[1,0,0],[0,1,0],[0,0,1]]
    A = legPositions
    B = defaultLegPositions
    centroidA = [0,0,0]
    centroidB = [0,0,0]
    for i in range(4):
        centroidA[0] += A[3*i+0]
        centroidA[1] += A[3*i+1]
        centroidA[2] += A[3*i+2]
        centroidB[0] += B[3*i+0]
        centroidB[1] += B[3*i+1]
        centroidB[2] += B[3*i+2]
    centroidA = [centroidA[0]/4, centroidA[1]/4, centroidA[2]/4]
    centroidB = [centroidB[0]/4, centroidB[1]/4, centroidB[2]/4]
    AA = [0]*12
    BB = [0]*12
    for i in range(4):
        AA[3*i+0] = A[3*i+0] - centroidA[0]
        AA[3*i+1] = A[3*i+1] - centroidA[1]
        AA[3*i+2] = A[3*i+2] - centroidA[2]
        BB[3*i+0] = B[3*i+0] - centroidB[0]
        BB[3*i+1] = B[3*i+1] - centroidB[1]
        BB[3*i+2] = B[3*i+2] - centroidB[2]
    H = [[0,0,0],[0,0,0],[0,0,0]]
    for i in range(4):
        ax = AA[3*i+0]; ay = AA[3*i+1]; az = AA[3*i+2]
        bx = BB[3*i+0]; by = BB[3*i+1]; bz = BB[3*i+2]
        H[0][0] += ax*bx; H[0][1] += ax*by; H[0][2] += ax*bz
        H[1][0] += ay*bx; H[1][1] += ay*by; H[1][2] += ay*bz
        H[2][0] += az*bx; H[2][1] += az*by; H[2][2] += az*bz
    U, V = svd3x3(H)
    R = mat3_mul(V, mat3_T(U))
    if mat3_det(R) < 0:
        V[0][2] = -V[0][2]
        V[1][2] = -V[1][2]
        V[2][2] = -V[2][2]
        R = mat3_mul(V, mat3_T(U))
    return R


def dogRotationFromMotorAngles(motorAngles):
    legPositions = legPositionsFromMotorAngles(motorAngles)
    return dogRotationFromLegPositions(legPositions)


def dogPositionFromMotorAngles(motorAngles):
    legPositions = legPositionsFromMotorAngles(motorAngles)
    averagePosition = [0, 0, 0]
    for i in range(12):
        if legPositions[i] is not None:
            averagePosition[i % 3] += 0.25*legPositions[i]
        else:
            return [None, None, None]
    #return averagePosition
    return vec3_rotate(averagePosition, dogRotationFromLegPositions(legPositions));


def motorAnglesTimeEvolution(motorAngles, timestamps, speed):
    #print("ma1", motorAngles, "\nsp1", speed)
    now = time.time()
    for i in range(6):
        timeDiff = 0.001*(now - timestamps[i + 1])
        if timeDiff > 0 and timeDiff < 2:
            if i < 4:
                idx = 3*i + 2
                if speed[idx] is not None:
                    motorAngles[idx] += round(speed[idx]*timeDiff)
            else:
                for idx in [6*(i - 4), 6*(i - 4) + 1, 6*(i - 4) + 3, 6*(i - 4) + 4]:
                    if speed[idx] is not None:
                        motorAngles[idx] += round(speed[idx]*timeDiff)
    #print("ma2", motorAngles, "\n")
    return motorAngles


def getBoundSpeed(speed):
    if speed > 1000:
        return 1000
    elif speed < -1000:
        return -1000
    return round(speed)


def flipBendDirection(legIds):
    global bendForward
    for id in legIds:
        if bendForward[id]:
            hub.speaker.beep(2000, 50)
            hub.speaker.beep(800, 50)
            bendForward[id] = False
        else:
            hub.speaker.beep(800, 50)
            hub.speaker.beep(2000, 50)
            bendForward[id] = True


def moveLegPositions(moveSpeed):
    global startMovePositions
    norm = sqrt(sum(x**2 for x in moveSpeed))
    if norm > 0:
        moveSpeed = [x / norm for x in moveSpeed]
    motorAnglesEvolved = getEvolvedMotorAngles()
    legPositions = legPositionsFromMotorAngles(motorAnglesEvolved.copy())
    if startMovePositions is None:
        startMovePositions = legPositions.copy()
    targetPositions = startMovePositions.copy()
    currentDiff = 0
    for i in range(12):
        if moveSpeed[i] != 0 and legPositions[i] is not None and startMovePositions[i] is not None:
            currentDiff += (legPositions[i] - startMovePositions[i])**2
    currentDiff = sqrt(currentDiff) + 10
    for i in range(12):
        if moveSpeed[i] != 0 and targetPositions[i] is not None:
            targetPositions[i] += currentDiff*moveSpeed[i]
    targetMotorAngles = motorAnglesFromLegPositions(targetPositions, bendForward)
    motorSpeeds = [0,0,0, 0,0,0, 0,0,0, 0,0,0]
    for i in range(12):
        if targetMotorAngles[i] is not None and motorAnglesEvolved[i] is not None:
            motorSpeeds[i] = targetMotorAngles[i] - motorAnglesEvolved[i]
    maxSpeed = abs(max(motorSpeeds, key=abs))
    if maxSpeed < 0.1:
        return sendCommand(getSpeedCmd(0, 0))
    for i in range(12):
        motorSpeeds[i] = floor(motorSpeeds[i]*1000/maxSpeed)
    return sendCommand([pack('<B12h',_CMD_SPEED, *motorSpeeds)])


def getSpeedCmd(speed, counter):
    buffer = bytearray(pack('<B12h',_CMD_SPEED, 0,0,0, 0,0,0, 0,0,0, 0,0,0))
    pack_into('<h', buffer, 1 + 2*counter, speed)
    return [buffer]


def getStatus():
    status = 0
    if(hub.battery.voltage() > 7000):
        status += 1
    status += 32
    ts = time.time()
    for i in range(1, 7):
        if(ts - hubTimestamps[i] > 2000):
            status -= 32
            break
    if(buttonMode):
        status += 64
    return status


def executeCommand(data):
    global hubTimestamps, hubSensorData, hubChecksums
    checksum = 0
    try:
        cmd = data[0][0]
        subcmd = data[0][1]
        for i in range(25):
            checksum ^= data[0][i]
    except:
        #print("failed to unpack", data)
        return
    hubTimestamps[0] = time.time()
    hubSensorData[0] = data
    hubChecksums[0] = checksum
    if cmd == _CMD_SUBCMD and subcmd == _SUBCMD_SHUTDOWN:
        hub.speaker.beep(1000, 20)
        wait(100)
        hub.speaker.beep(1000, 20)
        wait(100)
        hub.speaker.beep(1000, 20)
        wait(100)
        hub.speaker.beep(1000, 20)
        wait(100)
        hub.system.shutdown()


def getSensorData():
    global hubSensorData, hubTimestamps, hubChecksums, commandCounter
    for i in range(1, 7):
        receive = radio.observe(i)
        if receive:
            data = receive[0]
            if data == hubSensorData[i]:
                return
            else:
                hubSensorData[i] = receive[0]
                hubTimestamps[i] = time.time()
            try:
                status = receive[0][0]
                hubChecksums[i] = receive[0][1]
            except:
                #print("failed to unpack", receive)
                status = 0
            #print("receive", i, hubSensorData[i], status)
            if hubChecksums[i] == hubChecksums[0]:
                if (i <= 4 and (status & 0b00110011 == 0b00100011)) or (i > 4 and (status & 0b00111111 == 0b00111111)):
                    if all(hubChecksums[i] == hubChecksums[0] for i in range(6)):
                        #print("all checksums", hubChecksums[i])
                        commandCounter += 1
                        if commandCounter >= 2**16:
                            commandCounter = 0
                        command = [pack('<3B11h',_CMD_SUBCMD, _SUBCMD_WAIT,0,0,commandCounter, 0,0,0, 0,0,0, 0,0,0)]
                        sendCommand(command)



def getCommand():
    global buttonMode, selection, loopCounter, selectedSpeed, startMovePositions
    pressed = hub.buttons.pressed()
    #print("button mode is", buttonMode, selection)
    if buttonMode == _BUTTON_IDLE:
        if pressed == {Button.CENTER}:
            sendCommand(getSpeedCmd(0, 0))
            hub.speaker.beep(1000, 20)
            buttonMode = _BUTTON_ACTIVE
            selection = _SELECT_RETURN
        else:
            receive = radio.observe(0)
            if receive:
                executeCommand(receive)
    elif buttonMode == _BUTTON_ACTIVE:
        if pressed:
            loopCounter = 0
        else:
            buttonMode = _BUTTON_SELECT
    elif buttonMode == _BUTTON_INACTIVE:
        if pressed == {Button.CENTER}:
            loopCounter = 0
        else:
            buttonMode = _BUTTON_IDLE
    elif buttonMode == _BUTTON_SELECT:
        if not pressed:
            startMovePositions = None
        if pressed == {Button.CENTER}:
            if selection == _SELECT_SHUTDOWN:
                sendCommand(_CMD_SHUTDOWN_PACK)
            buttonMode = _BUTTON_INACTIVE
        elif pressed == {Button.LEFT}:
            if(selection > 0):
                selection -= 1
            else:
                selection = 8
            buttonMode = _BUTTON_ACTIVE
        elif pressed == {Button.RIGHT}:
            if(selection < 8):
                selection += 1
            else:
                selection = 0
            buttonMode = _BUTTON_ACTIVE
        else:
            pitch, roll = hub.imu.tilt()
            if(selection == 0):
                if pressed == {Button.BLUETOOTH, Button.LEFT} or pressed == {Button.BLUETOOTH, Button.RIGHT} or pressed == {Button.BLUETOOTH}:
                    selectedSpeed = 1000
                    moveSpeed = [0,0,0]
                    if Button.RIGHT in pressed:
                        moveSpeed[1] = 1
                    elif Button.LEFT in pressed:
                        moveSpeed[1] = -1
                    if roll < -10:
                        moveSpeed[2] = 1
                    elif roll > 10:
                        moveSpeed[2] = -1
                    if pitch < -10:
                        moveSpeed[0] = -1
                    elif pitch > 10:
                        moveSpeed[0] = 1
                    return moveLegPositions(moveSpeed*4)
                elif pressed == {Button.BLUETOOTH, Button.CENTER}:
                    buttonMode = _BUTTON_ACTIVE
                    return flipBendDirection([0, 1, 2, 3])
                else:
                    selectedSpeed = 0
                    return sendCommand(getSpeedCmd(0, 0))
            elif(selection < 5):
                if pressed == {Button.BLUETOOTH, Button.LEFT} or pressed == {Button.BLUETOOTH, Button.RIGHT} or pressed == {Button.BLUETOOTH}:
                    selectedSpeed = 1000
                    moveSpeed = [0,0,0, 0,0,0, 0,0,0, 0,0,0]
                    if Button.RIGHT in pressed:
                        moveSpeed[3*selection - 2] = 1
                    elif Button.LEFT in pressed:
                        moveSpeed[3*selection - 2] = -1
                    if roll < -10:
                        moveSpeed[3*selection - 1] = 1
                    elif roll > 10:
                        moveSpeed[3*selection - 1] = -1
                    if pitch < -10:
                        moveSpeed[3*selection - 3] = -1
                    elif pitch > 10:
                        moveSpeed[3*selection - 3] = 1
                    return moveLegPositions(moveSpeed)
                elif pressed == {Button.BLUETOOTH, Button.CENTER}:
                    buttonMode = _BUTTON_ACTIVE
                    return flipBendDirection([selection - 1])
                elif(roll < -10):
                    motor = 1 + selection % 2
                    selectedSpeed = getBoundSpeed(pitch*30)
                    return sendCommand(getSpeedCmd(selectedSpeed, motor + 3*(selection - 1)))
                elif(roll > 10):
                    motor = 1 + (selection + 1) % 2
                    selectedSpeed = getBoundSpeed(pitch*30)
                    return sendCommand(getSpeedCmd(selectedSpeed, motor + 3*(selection - 1)))
                else:
                    selectedSpeed = 0
                    return sendCommand(getSpeedCmd(0, 0))
            elif(selection < 7):
                if pressed == {Button.BLUETOOTH, Button.LEFT} or pressed == {Button.BLUETOOTH, Button.RIGHT} or pressed == {Button.BLUETOOTH}:
                    selectedSpeed = 1000
                    rotationSpeed = [0,0,0]
                    if Button.RIGHT in pressed:
                        rotationSpeed[1] = 1
                    elif Button.LEFT in pressed:
                        rotationSpeed[1] = -1
                    if roll < -10:
                        rotationSpeed[0] = 1
                    elif roll > 10:
                        rotationSpeed[0] = -1
                    if pitch < -10:
                        rotationSpeed[2] = -1
                    elif pitch > 10:
                        rotationSpeed[2] = 1
                    rotMatrix = mat3_from_euler(*rotationSpeed)
                    pos = legPositionsFromMotorAngles(getEvolvedMotorAngles())
                    dest = pos.copy()
                    for i in range(4):
                        [dest[3*i], dest[3*i + 1], dest[3*i + 2]] = vec3_rotate([pos[3*i], pos[3*i + 1], pos[3*i + 2]], rotMatrix)
                    moveSpeed = [0,0,0, 0,0,0, 0,0,0, 0,0,0]
                    for i in range(12):
                        moveSpeed[i] = dest[i] - pos[i]
                    return moveLegPositions(moveSpeed)
                elif pressed == {Button.BLUETOOTH, Button.CENTER}:
                    buttonMode = _BUTTON_ACTIVE
                    return flipBendDirection([2*(selection - 5), 2*(selection - 5) + 1])
                elif(roll < -10):
                    selectedSpeed = getBoundSpeed(pitch*30)
                    return sendCommand(getSpeedCmd(selectedSpeed, 6*(selection - 5)))
                elif(roll > 10):
                    selectedSpeed = getBoundSpeed(pitch*30)
                    return sendCommand(getSpeedCmd(selectedSpeed, 3 + 6*(selection - 5)))
                else:
                    selectedSpeed = 0
                    return sendCommand(getSpeedCmd(0, 0))
            elif(selection == _SELECT_RETURN):
                if(pressed == {Button.BLUETOOTH}):
                    selectedSpeed = 1000
                    sendCommand([pack('<3B11h',_CMD_SUBCMD, _SUBCMD_RESET,0,0,0, 0,0,0, 0,0,0, 0,0,0)])
                    hub.speaker.beep(500, 100)
                    wait(300)
                    hub.speaker.beep(500, 100)
                    sendCommand([pack('<B12h',_CMD_DATA, 0,0,0, 0,0,0, 0,0,0, 0,0,0)])
                else:
                    selectedSpeed = 0


def setLedColor():
    global loopCounter
    status = getStatus()
    h = 0
    s = 100
    v = 0
    matrix = _LEDICONS[0]*0
    if(loopCounter < 10 or loopCounter > 990):
        v = 100
        s = 0
    elif(loopCounter < 15 or loopCounter > 985):
        v = 20
        s = 0
    else:
        v = 20 + 2e-4*(500 - loopCounter)**2
    if(status & 0b01111111 == 0b00100001):
        h = 240
        ts = time.time()
        for i in range(7):
            matrix += 0.999**(ts - hubTimestamps[i])*_LEDICONS[i]
    elif(status & 0b01111111 == 0b00000001):
        h = 160
        ts = time.time()
        for i in range(7):
            matrix += 0.999**(ts - hubTimestamps[i])*_LEDICONS[i]
    elif(status & 0b01000000 == 0b01000000): #selected
        if(selectedSpeed == 0):
            h = 60
        else:
            h = 300
            v = 0.1*abs(selectedSpeed)
        matrix = _LEDICONS[selection]
    hub.light.on(Color(h, s, v))
    hub.display.icon(matrix)
    loopCounter = (loopCounter + 1) % 1000



def sendCommand(command):
    radio.broadcast(command)
    executeCommand(command)


command = [pack('<3B11h',_CMD_SUBCMD, _SUBCMD_WAIT,0,0,commandCounter, 0,0,0, 0,0,0, 0,0,0)]
sendCommand(command)
while(True):
    getCommand()
    getSensorData()
    setLedColor()
