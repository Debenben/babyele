from pybricks.hubs import InventorHub
from pybricks.messaging import BLERadio
from pybricks.parameters import Color, Button
from pybricks.tools import wait, StopWatch, Matrix

from umath import floor, acos, pi, sqrt, sin, cos, asin, acos, atan2
from ustruct import unpack_from, pack, pack_into
from urandom import randint

_HUBID = const(0)

_CMD_KEEPALIVE = const(0)
_CMD_SPEED = const(1)
_CMD_ANGLE = const(2)
_CMD_RESET = const(3)
_CMD_SHUTDOWN = const(4)

_CMD_SHUTDOWN_PACK = [pack('<B12h',_CMD_SHUTDOWN, 0,0,0, 0,0,0, 0,0,0, 0,0,0)]

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
buttonMode = _BUTTON_IDLE
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
    if cosVal > 1.0:
        return 1.0
    elif cosVal < -1.0:
        return -1.0
    else:
        return cosVal


defaultLegPositions = [0.5*_LEG_SEPARATION_LENGTH, -_LEG_MOUNT_HEIGHT,  (0.5*_LEG_SEPARATION_WIDTH - _LEG_MOUNT_WIDTH),
                       0.5*_LEG_SEPARATION_LENGTH, -_LEG_MOUNT_HEIGHT, -(0.5*_LEG_SEPARATION_WIDTH - _LEG_MOUNT_WIDTH),
                      -0.5*_LEG_SEPARATION_LENGTH, -_LEG_MOUNT_HEIGHT,  (0.5*_LEG_SEPARATION_WIDTH - _LEG_MOUNT_WIDTH),
                      -0.5*_LEG_SEPARATION_LENGTH, -_LEG_MOUNT_HEIGHT, -(0.5*_LEG_SEPARATION_WIDTH - _LEG_MOUNT_WIDTH)]

defaultRelativeLegPositions = [0.5*_LEG_SEPARATION_LENGTH, 0,  (0.5*_LEG_SEPARATION_WIDTH - _LEG_MOUNT_WIDTH),
                               0.5*_LEG_SEPARATION_LENGTH, 0, -(0.5*_LEG_SEPARATION_WIDTH - _LEG_MOUNT_WIDTH),
                              -0.5*_LEG_SEPARATION_LENGTH, 0,  (0.5*_LEG_SEPARATION_WIDTH - _LEG_MOUNT_WIDTH),
                              -0.5*_LEG_SEPARATION_LENGTH, 0, -(0.5*_LEG_SEPARATION_WIDTH - _LEG_MOUNT_WIDTH)]

mountAngleOffset = invCosLaw(_LEG_PISTON_HEIGHT, _LEG_PISTON_WIDTH, _LEG_PISTON_LENGTH)


def getMotorAngles():
    motorAngles = [None for i in range(12)]
    for i in range(1, 5):
        if hubSensorData[i] is not None:
            motorAngles[3*(i - 1) + 2] = unpack_from('<h', hubSensorData[i], 8)[0]
    for i in range(5, 7):
        if hubSensorData[i] is not None:
            motorAngles[6*(i - 5)] = unpack_from('<h', hubSensorData[i], 8)[0]
            motorAngles[6*(i - 5) + 1] = unpack_from('<h', hubSensorData[i], 10)[0]
            motorAngles[6*(i - 5) + 3] = unpack_from('<h', hubSensorData[i], 12)[0]
            motorAngles[6*(i - 5) + 4] = unpack_from('<h', hubSensorData[i], 14)[0]
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


def dogPositionFromMotorAngles(motorAngles):
    averagePosition = [0, 0, 0]
    legPositions = legPositionsFromMotorAngles(motorAngles)
    for i in range(12):
        averagePosition[i % 3] += legPositions[i]
    #return vec3Rotate(averagePosition, dogRotationFromMotorAngles(motorAngles));
    return averagePosition


def dogRotationFromMotorAngles(motorAngles):
    averagePosition = [0, 0, 0]
    legPositions = legPositionsFromMotorAngles(motorAngles)
    for i in range(12):
        averagePosition[i % 3] += legPositions[i]
    for i in range(12):
        legPositions[i] -= averagePosition[i % 3]
    quat = [0, 0, 0, 1]
    for i in range(4):
        axis = [legPositions[3*i + 1]*defaultRelativeLegPositions[3*i + 2] - legPositions[3*i + 2]*defaultRelativeLegPositions[3*i + 1],
                legPositions[3*i + 2]*defaultRelativeLegPositions[3*i + 0] - legPositions[3*i + 0]*defaultRelativeLegPositions[3*i + 2],
                legPositions[3*i + 0]*defaultRelativeLegPositions[3*i + 1] - legPositions[3*i + 1]*defaultRelativeLegPositions[3*i + 0]]
        legPositionsLength = sqrt(legPositions[3*i]**2 + legPositions[3*i + 1]**2 + legPositions[3*i + 2])
        defaultRelativeLegPositionsLength = sqrt(defaultRelativeLegPositions[3*i]**2 + defaultRelativeLegPositions[3*i + 1]**2 + defaultRelativeLegPositions[3*i + 2]**2)
        if legPositionsLength > 0 and defaultRelativeLegPositionsLength > 0:
            dot = legPositions[3*i]*defaultRelativeLegPositions[3*i] + legPositions[3*i + 1]*defaultRelativeLegPositions[3*i + 1] + legPositions[3*i + 2]*defaultRelativeLegPositions[3*i + 2]
            angle = acos(dot/(legPositionsLength*defaultRelativeLegPositionsLength))

  for(let i = 0; i < 4; i++) {
    const axis = vec3Cross(relativePositions[i], defaultRelativeLegPositions[i]);
    const angle = Math.acos(vec3Dot(relativePositions[i], defaultRelativeLegPositions[i]) / (vec3Len(relativePositions[i]) * vec3Len(defaultRelativeLegPositions[i])));
    if(!isNaN(angle)) quat = vec4Cross(quatFromAxisAngle(axis, angle), quat);
  }
  const axis = [quat[0], quat[1], quat[2]];
  let rotationAngle = 0;
  for(let i = 0; i < 4; i++) {
    const relativeProj = vec3Proj(relativePositions[i], axis);
    const defaultProj = vec3Proj(defaultRelativeLegPositions[i], axis);
    const angle = Math.acos(vec3Dot(relativeProj, defaultProj) / (vec3Len(relativeProj) * vec3Len(defaultProj)));
    if(!isNaN(angle)) rotationAngle += 0.25*angle;
  }
  return quatFromAxisAngle(axis, rotationAngle);
}


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
        for i in range(25):
            checksum ^= data[0][i]
    except:
        #print("failed to unpack", data)
        return
    hubTimestamps[0] = time.time()
    hubSensorData[0] = data
    hubChecksums[0] = checksum
    if cmd == _CMD_SHUTDOWN:
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
                        commandCounter += 1
                        if commandCounter >= 2**16:
                            commandCounter = 0
                        command = [pack('<B12h',_CMD_KEEPALIVE, commandCounter,0,0, 0,0,0, 0,0,0, 0,0,0)]
                        #print("all checksums", hubChecksums[i])
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
                    legPositions = legPositionsFromMotorAngles(getMotorAngles())
                    print("pos", legPositions)
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
                    print("pos", legPositions)
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
                    sendCommand([pack('<B12h',_CMD_RESET, 0,0,0, 0,0,0, 0,0,0, 0,0,0)])
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


command = [pack('<B12h',_CMD_KEEPALIVE, commandCounter,0,0, 0,0,0, 0,0,0, 0,0,0)]
sendCommand(command)
while(True):
    getCommand()
    getSensorData()
    setLedColor()
