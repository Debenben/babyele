import { TextBlock, Container, Control, Image } from "babylonjs-gui";
import { ipcRenderer } from 'electron';
import { Infobox, buildText } from './infobox';
import { GuiTexture } from './guitexture';

export class LegInfobox extends Infobox {
  gauge: Container;
  speedArrow: Indicator;
  angleArrow: Indicator;
  tiltArrow: Indicator;
  rotationValue = 0;
  tiltValue = 0;
  speedValue = 0;
  infoText: TextBlock;

  constructor(name: string, preview: boolean, guiTexture: GuiTexture) {
    super(name, preview, guiTexture);
    this.addControls();
  }
  addControls() {
    this.gauge = buildAngleGauge(this);
    this.panel.addControl(this.gauge);
    ipcRenderer.on('notifyLegRotation', this.updateAngle);
    ipcRenderer.on('notifyTilt', this.updateTilt);
    ipcRenderer.on('notifyMotorSpeed', this.updateMotorSpeed);
    ipcRenderer.send(this.name.replace("Top","").replace("Bottom","").replace("Mount",""), "getProperties");
  }
  removeControls() {
    ipcRenderer.removeListener('notifyLegRotation', this.updateAngle);
    ipcRenderer.removeListener('notifyTilt', this.updateTilt);
    ipcRenderer.removeListener('notifyMotorSpeed', this.updateMotorSpeed);
  }
  updateTilt = (event, arg1, arg2) => {
    if(this.name.startsWith(arg1)) {
      this.tiltValue = extractCoordinate(arg2, this.name);
      this.tiltArrow.rotation = rotationToGauge(this.tiltValue);
      if(this.tiltArrow.highlight) {
	this.infoText.text = printDegree(this.tiltValue);
      }
    }
  }
  updateAngle = (event, arg1, arg2) => {
    if(this.name.startsWith(arg1)) {
      this.rotationValue = extractCoordinate(arg2, this.name);
      if(!this.angleArrow.highlight) {
        this.angleArrow.rotation = rotationToGauge(this.rotationValue);
        if(this.infoText.color == "black") this.infoText.text = printDegree(this.rotationValue);
      }
    }
  }
  updateMotorSpeed = (event, arg1, arg2) => {
    if(this.name.startsWith(arg1)) {
      this.speedValue = extractCoordinate(arg2, this.name);
      if(!this.speedArrow.highlight) {
        this.speedArrow.rotation = speedToGauge(this.speedValue);
      }
    }
  }
}

const printDegree = (rad: number) => (180*rad/Math.PI).toFixed(2) + "°";

class Indicator extends Container {
  highlight = false;
  select = false;
  arrowImage = new Image("arrow", "../public/arrow_u.svg");
  constructor(pix: number) {
    super();
    this.widthInPixels = pix;
    this.heightInPixels = pix;
    this.arrowImage.widthInPixels = 30;
    this.arrowImage.heightInPixels = 30;
    this.arrowImage.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.addControl(this.arrowImage);
  }
  updateImage() {
    this.arrowImage.source = "../public/arrow_" + (this.select ? "s" : (this.highlight ? "h" : "u")) + ".svg";
  }
}

const extractCoordinate = (vec3: number[], partName: string) => {
  if(partName.endsWith("Mount")) return vec3[0];
  else if(partName.endsWith("Top")) return vec3[1];
  else if(partName.endsWith("Bottom")) return vec3[2];
}
const gaugeToRotation = (angle: number) => {
  return angle > 0 ? Math.PI - angle : -Math.PI - angle;
}
const rotationToGauge = gaugeToRotation;
const gaugeToSpeed = (angle: number) => {
  let speed = Math.round(4000*angle/Math.PI);
  if(speed > 1000) speed = 1000;
  else if (speed < -1000) speed = -1000;
  return speed;
}
const speedToGauge = (speed: number) => {
  return speed*Math.PI/4000;
}

const buildAngleGauge = (ibox: LegInfobox) => {
  const gauge = new Container();
  gauge.widthInPixels = 240;
  gauge.heightInPixels = 280;
  gauge.paddingBottomInPixels = -0.05*ibox.widthInPixels;
  gauge.paddingTopInPixels = 0.05*ibox.widthInPixels;
  const innerRadius = 80;
  const middleRadius = 110;
  const outerRadius = 140;

  const scale = new Image("scale", "../public/dial.svg");
  gauge.addControl(scale);

  ibox.infoText = buildText("---");
  ibox.infoText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  gauge.addControl(ibox.infoText);

  ibox.speedArrow = new Indicator(2*outerRadius);
  gauge.addControl(ibox.speedArrow);

  ibox.angleArrow = new Indicator(2*middleRadius);
  ibox.angleArrow.arrowImage.rotation = Math.PI;
  gauge.addControl(ibox.angleArrow);

  ibox.tiltArrow = new Indicator(2*innerRadius);
  gauge.addControl(ibox.tiltArrow);

  const mouseOverlay = new Container();
  mouseOverlay.widthInPixels = gauge.widthInPixels;
  mouseOverlay.heightInPixels = gauge.heightInPixels;
  const gaugeOnPointer = (vec) => {
    const xval = vec.x - mouseOverlay.centerX;
    const yval = -vec.y + mouseOverlay.centerY;
    const radius = Math.sqrt(xval**2 + yval**2)/ibox.guiTexture.getScale();
    const angle = Math.atan2(xval, yval);
    if(radius < outerRadius && radius > middleRadius && Math.abs(angle) < 0.9 && !ibox.angleArrow.select && !ibox.tiltArrow.select) {
      ibox.speedArrow.highlight = true;
      ibox.angleArrow.highlight = false;
      ibox.tiltArrow.highlight  = false;
      ibox.speedArrow.rotation = (angle > Math.PI/4 ? Math.PI/4 : (angle < -Math.PI/4 ? -Math.PI/4 : angle));
      ibox.angleArrow.rotation = rotationToGauge(ibox.rotationValue);
      ibox.infoText.color = "lightgrey";
      ibox.infoText.text = gaugeToSpeed(angle).toString();
      if(ibox.speedArrow.select) {
        ipcRenderer.send(ibox.name, "requestRotationSpeed", gaugeToSpeed(angle));
      }
    }
    else if (radius < middleRadius && radius > innerRadius && !ibox.speedArrow.select && !ibox.tiltArrow.select) {
      ibox.speedArrow.highlight = false;
      ibox.angleArrow.highlight = true;
      ibox.tiltArrow.highlight  = false;
      ibox.speedArrow.rotation = speedToGauge(ibox.speedValue);
      ibox.angleArrow.rotation = angle;
      ibox.infoText.color = "lightgrey";
      ibox.infoText.text = printDegree(gaugeToRotation(angle));
      if(ibox.angleArrow.select){
        ipcRenderer.send(ibox.name, "requestRotationAngle", gaugeToRotation(angle));
      }
    }
    else if (radius < innerRadius && !ibox.speedArrow.select && !ibox.angleArrow.select) {
      ibox.speedArrow.highlight = false;
      ibox.angleArrow.highlight = false;
      ibox.tiltArrow.highlight  = true;
      ibox.speedArrow.rotation = speedToGauge(ibox.speedValue);
      ibox.angleArrow.rotation = rotationToGauge(ibox.rotationValue);
      ibox.infoText.color = "lightgrey";
      ibox.infoText.text = printDegree(ibox.tiltValue);
      if(ibox.tiltArrow.select) {
        ipcRenderer.send(ibox.name, "requestSync");
      }
    }
    else if (!ibox.speedArrow.select && !ibox.angleArrow.select && !ibox.tiltArrow.select) {
      ibox.speedArrow.highlight = false;
      ibox.angleArrow.highlight = false;
      ibox.tiltArrow.highlight  = false;
      ibox.speedArrow.rotation = speedToGauge(ibox.speedValue);
      ibox.angleArrow.rotation = rotationToGauge(ibox.rotationValue);
      ibox.infoText.color = "black";
      ibox.infoText.text = printDegree(ibox.rotationValue);
    }
    ibox.speedArrow.updateImage();
    ibox.angleArrow.updateImage();
    ibox.tiltArrow.updateImage();
  };
  mouseOverlay.onPointerMoveObservable.add(gaugeOnPointer);
  mouseOverlay.onPointerOutObservable.add(gaugeOnPointer);
  mouseOverlay.onPointerDownObservable.add((vec) => {
    const xval = vec.x - mouseOverlay.centerX;
    const yval = -vec.y + mouseOverlay.centerY;
    const radius = Math.sqrt(xval**2 + yval**2)/ibox.guiTexture.getScale();
    const angle = Math.atan2(xval, yval);
    if(radius < outerRadius && radius > middleRadius && Math.abs(angle) < 0.9) {
      ibox.speedArrow.select = true;
    }
    else if (radius < middleRadius && radius > innerRadius) {
      ibox.angleArrow.select = true;
    }
    else if (radius < innerRadius) {
      ibox.tiltArrow.select = true;
    }
    gaugeOnPointer(vec);
  });
  mouseOverlay.onPointerUpObservable.add((vec) => {
    if(ibox.speedArrow.select) {
      ipcRenderer.send(ibox.name, "requestRotationSpeed", 0);
    }
    ibox.speedArrow.select = false;
    ibox.angleArrow.select = false;
    ibox.tiltArrow.select  = false;
    gaugeOnPointer(vec);
  });
  gauge.addControl(mouseOverlay);
  return gauge;
}
