import { AbsoluteMotor, Consts } from "node-poweredup"

export class Leg {
	topMotor: AbsoluteMotor
	bottomMotor: AbsoluteMotor
	topMotorAngle: number = 0.0
	bottomMotorAngle: number = 0.0
	topMotorRange: number
	bottomMotorRange: number
	topLength: number = 185
	bottomLength: number = 200

	constructor(topMotor, topMotorRange, bottomMotor, bottomMotorRange) {
	//motorRange = rotation in degree needed for pi/2 forward rotation of segment
		this.topMotor = topMotor;
		this.topMotorRange = topMotorRange;
		this.bottomMotor = bottomMotor;
		this.bottomMotorRange = bottomMotorRange;

		[topMotor, bottomMotor].forEach(async (motor) => {
	                motor.resetZero();
	                motor.setBrakingStyle(Consts.BrakingStyle.HOLD);
	                motor.gotoAngle(0);
		});
	}
	getHeight() {
		const topAngle = 0.5*Math.PI*this.topMotorAngle/this.topMotorRange
		const bottomAngle = 0.5*Math.PI*this.bottomMotorAngle/this.bottomMotorRange - topAngle
		return this.topLength*Math.cos(topAngle) + this.bottomLength*Math.cos(bottomAngle)
	}
	getXPos() {
		const topAngle = 0.5*Math.PI*this.topMotorAngle/this.topMotorRange
		const bottomAngle = 0.5*Math.PI*this.bottomMotorAngle/this.bottomMotorRange - topAngle
		return this.topLength*Math.sin(topAngle) + this.bottomLength*Math.sin(bottomAngle)
	}

	setPosition(height, xPos) {
		const h = height
		const p = xPos
		const t = this.topLength
		const b = this.bottomLength
		const root = Math.sqrt(0.0 - b**4*p**2*t**2 + 2*b**2*h**2*p**2*t**2 + 2*b**2*p**4*t**2 + 2*b**2*p**2*t**4 - h**4*p**2*t**2 - 2*h**2*p**4*t**2 + 2*h**2*p**2*t**4 - p**6*t**2 + 2*p**4*t**4 - p**2*t**6) + h**3*t + h*p**2*t + h*t**3
		let cosval = (0.0 - b**2*h*t - root)/(2*(h**2*t**2 + p**2*t**2))
		if(cosval < -1.0) {
			cosval = (0.0 - b**2*h*t + root)/(2*(h**2*t**2 + p**2*t**2))
		}
		let topAngle = Math.acos(cosval)
		if((p-t*Math.sin(topAngle))/b < -1.0) {
			topAngle = -topAngle
		}
		const bottomAngle = Math.asin((p-t*Math.sin(topAngle))/b) - topAngle

		const destTopMotorAngle = 2*topAngle*this.topMotorRange/Math.PI
		const destBottomMotorAngle = 2*bottomAngle*this.bottomMotorRange/Math.PI
		const diffTopMotorAngle = destTopMotorAngle - this.topMotorAngle
		const diffBottomMotorAngle = destBottomMotorAngle - this.bottomMotorAngle
		const topMotorSpeed = 100*diffTopMotorAngle/Math.max(Math.abs(diffTopMotorAngle),Math.abs(diffBottomMotorAngle))
		const bottomMotorSpeed = 100*diffBottomMotorAngle/Math.max(Math.abs(diffTopMotorAngle),Math.abs(diffBottomMotorAngle))

		this.topMotorAngle = destTopMotorAngle;
		this.bottomMotorAngle = destBottomMotorAngle;
		return Promise.all([ this.topMotor.rotateByDegrees(Math.abs(diffTopMotorAngle), topMotorSpeed), this.bottomMotor.rotateByDegrees(Math.abs(diffBottomMotorAngle), bottomMotorSpeed) ])
	}
}
