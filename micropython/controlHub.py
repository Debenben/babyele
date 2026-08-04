from pybricks.hubs import InventorHub
from pybricks.messaging import BLERadio
from pybricks.parameters import Color, Button
from pybricks.tools import wait, StopWatch, Matrix

from umath import floor, acos, pi, sqrt, sin, cos, asin, acos, atan2, copysign
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
    cosVal = (rSide**2 + lSide**2 - oSide**2)/(2*rSide*lSide)
    return acos(max(-1.0, min(1.0, cosVal)))


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
    motorAngles = [None for i in range(12)]
    for i in range(1, 5):
        if hubSensorData[i] is not None:
            motorAngles[3*(i - 1) + 2] = 10*unpack_from('<h', hubSensorData[i], 8)[0]
    for i in range(5, 7):
        if hubSensorData[i] is not None:
            motorAngles[6*(i - 5)] = 10*unpack_from('<h', hubSensorData[i], 8)[0]
            motorAngles[6*(i - 5) + 1] = 10*unpack_from('<h', hubSensorData[i], 10)[0]
            motorAngles[6*(i - 5) + 3] = 10*unpack_from('<h', hubSensorData[i], 12)[0]
            motorAngles[6*(i - 5) + 4] = 10*unpack_from('<h', hubSensorData[i], 14)[0]
    return motorAngles


def legAnglesFromMotorAngles(motorAngles):
    for i in range(4):
        if motorAngles[3*i] is not None:
            pistonLength = _LEG_PISTON_LENGTH + motorAngles[3*i]/_MOUNT_MOTOR_RANGE
            motorAngles[3*i] = invCosLaw(_LEG_PISTON_HEIGHT, _LEG_PISTON_WIDTH, pistonLength) - mountAngleOffset
        if motorAngles[3*i + 1] is not None:
            motorAngles[3*i + 1] *= pi/_TOP_MOTOR_RANGE
        if motorAngles[3*i + 2] is not None:
            motorAngles[3*i + 2] *= pi/_BOTTOM_MOTOR_RANGE
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
    for i in range(4):
        if vec[3*i] is not None and vec[3*i + 1] is not None and vec[3*i + 2] is not None:
            tAngle = vec[3*i + 1]
            bAngle = vec[3*i + 2] + tAngle
            forward = _LEG_LENGTH_TOP*sin(tAngle) + _LEG_LENGTH_BOTTOM*sin(bAngle)
            mHeight = _LEG_LENGTH_TOP*cos(tAngle) + _LEG_LENGTH_BOTTOM*cos(bAngle) - _LEG_MOUNT_HEIGHT
            mAngle = vec[3*i] + atan2(_LEG_MOUNT_WIDTH, mHeight)
            mLength = sqrt(abs(mHeight**2 + _LEG_MOUNT_WIDTH**2))
            vec[3*i] = forward
            vec[3*i + 1] = -mLength*cos(mAngle) #height
            vec[3*i + 2] = mLength*sin(mAngle) #sideways
    for i in [0, 5, 6, 11]:
        if vec[i] is not None:
            vec[i] *= -1
    for i in range(12):
        if vec[i] is not None:
            vec[i] += defaultLegPositions[i]
    return vec


def motorAnglesFromLegPositions(positions, bendForward):
    for i in range(12):
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


def getBoundSpeed(speed):
    if speed > 1000:
        return 1000
    elif speed < -1000:
        return -1000
    return round(speed)


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
        if(ts - hubTimestamps[i] > 10000):
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
            hubSensorData[i] = receive[0]
            try:
                status = receive[0][0]
                hubChecksums[i] = receive[0][1]
            except:
                #print("failed to unpack", receive)
                status = 0
            #print("receive", i, hubSensorData[i], status)
            if hubChecksums[i] == hubChecksums[0]:
                if (i <= 4 and (status & 0b00110011 == 0b00100011)) or (i > 4 and (status & 0b00111111 == 0b00111111)):
                    hubTimestamps[i] = time.time()
                    if all(hubChecksums[i] == hubChecksums[0] for i in range(6)):
                        #print("all checksums", hubChecksums[i])
                        commandCounter += 1
                        if commandCounter >= 2**16:
                            commandCounter = 0
                        command = [pack('<3B11h',_CMD_SUBCMD, _SUBCMD_WAIT,0,0,commandCounter, 0,0,0, 0,0,0, 0,0,0)]
                        sendCommand(command)



def getCommand():
    global buttonMode, selection, loopCounter, selectedSpeed
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
                    dogPosition = dogPositionFromMotorAngles(getMotorAngles())
                    dogRotation = euler_from_quat(quat_from_mat3(dogRotationFromMotorAngles(getMotorAngles())))
                    print("pos", [f"{num:.2f}" for num in dogPosition], "rot", [f"{num:.2f}" for num in dogRotation])
                    if Button.RIGHT in pressed:
                        print("dog up")
                    elif Button.LEFT in pressed:
                        print("dog down")
                    if roll < -10:
                        print("dog left")
                    elif roll > 10:
                        print("dog right")
                    if pitch < -10:
                        print("dog backward")
                    elif pitch > 10:
                        print("dog forward")
                else:
                    selectedSpeed = 0
                    sendCommand(getSpeedCmd(0, 0))
            elif(selection < 5):
                if pressed == {Button.BLUETOOTH, Button.LEFT} or pressed == {Button.BLUETOOTH, Button.RIGHT} or pressed == {Button.BLUETOOTH}:
                    selectedSpeed = 1000
                    legPositions = legPositionsFromMotorAngles(getMotorAngles())
                    print("pos", [f"{num:.2f}" for num in legPositions])
                    if Button.RIGHT in pressed:
                        print("leg", selection, "up")
                    elif Button.LEFT in pressed:
                        print("leg", selection, "down")
                    if roll < -10:
                        print("leg", selection, "left")
                    elif roll > 10:
                        print("leg", selection, "right")
                    if pitch < -10:
                        print("leg", selection, "backward")
                    elif pitch > 10:
                        print("leg", selection, "forward")
                elif(roll < -10):
                    motor = 1 + selection % 2
                    selectedSpeed = getBoundSpeed(pitch*30)
                    sendCommand(getSpeedCmd(selectedSpeed, motor + 3*(selection - 1)))
                elif(roll > 10):
                    motor = 1 + (selection + 1) % 2
                    selectedSpeed = getBoundSpeed(pitch*30)
                    sendCommand(getSpeedCmd(selectedSpeed, motor + 3*(selection - 1)))
                else:
                    selectedSpeed = 0
                    sendCommand(getSpeedCmd(0, 0))
            elif(selection < 7):
                motor = 0
                if(roll < -10):
                    selectedSpeed = getBoundSpeed(pitch*30)
                elif(roll > 10):
                    selectedSpeed = getBoundSpeed(pitch*30)
                    motor = 3
                else:
                    selectedSpeed = 0
                sendCommand(getSpeedCmd(selectedSpeed, motor + 6*(selection - 5)))
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
