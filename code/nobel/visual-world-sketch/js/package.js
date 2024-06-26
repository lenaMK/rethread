class Package {

    constructor(x, y, colorPallete, country, path, name) {
        this.colorPallete = colorPallete;
        this.acceleration = createVector(0, 0);
        this.velocity = createVector(2, 0);
        this.position = createVector(x, y);
        this.countryName = name;

        this.r = random(2, 5); // Half the width of veihcle's back side
        this.maxspeed = random(2, 3); //
        this.maxforce = 0.1;
        this.country = country;
        this.goalPos = country.getPosition();

        this.size = random(1, 4);
        this.state = "APPEAR";
        this.path = path;
        this.alpha = 0;
    }



    /////////////////////////////
    follow() {
        const p = this.path;
        // Predict the vehicle future location
        let predict = this.velocity.copy();
        predict.normalize();
        // 25 pixels ahead in current velocity direction
        predict.mult(25);
        // Get the predicted point
        let predictLoc = p5.Vector.add(this.position, predict);

        // Find the nomal point along the path
        let target = 0;
        let worldRecord = 1000000;

        for (let i = 0; i < p.points.length - 1; i++) {
            let a = p.points[i].copy(); // i = 3
            let b = p.points[i + 1].copy(); // i+1= 4 (last point)
            let normalPoint = this.getNormalPoint(predictLoc, a, b);

            // Check if the normal point is outside the line segment
            if (normalPoint.x < a.x || normalPoint.x > b.x) {
                normalPoint = b.copy();
            }

            // Length of normal from precictLoc to normalPoint
            let distance = p5.Vector.dist(predictLoc, normalPoint);

            // Check if this normalPoint is nearest to the predictLoc
            if (distance < worldRecord) {
                worldRecord = distance;
                // Move a little further along the path and set a target
                // let dir = p5.Vector.sub(a, b);
                // dir.normalize();
                // dir.mult(10);
                // let target = p5.Vector.add(normalPoint, dir);

                // or let the target be the normal point
                target = normalPoint.copy();
            }
        }

        // seek the target...
        this.seek(target);

        // ... or check if we are off the path:
        // if (distance > p.radius) {
        //    this.seek(target);
        // }


    }


    ////////////////////////////////////////////////////
    // Get the normal point from p to line segment ab
    getNormalPoint(p, a, b) {

        let ap = p5.Vector.sub(p, a);
        let ab = p5.Vector.sub(b, a);
        ab.normalize();

        // Instead of d = ap.mag() * cos(theta)
        // See file explanation.js or page 290
        let d = ap.dot(ab);

        ab.mult(d);

        let normalPoint = p5.Vector.add(a, ab);
        return normalPoint;
    }


    /////////////////////////////////////////////////////
    seek(target) {
        let desired = p5.Vector.sub(target, this.position);
        desired.normalize();
        desired.mult(this.maxspeed);
        let steer = p5.Vector.sub(desired, this.velocity);
        steer.limit(this.maxforce);
        this.applyForce(steer);
    }


    ////////////////////////////////
    update() {


        switch (this.state) {
            case "APPEAR":
                this.velocity.add(this.acceleration);
                this.velocity.limit(this.maxspeed);
                this.position.add(this.velocity);
                this.acceleration.mult(0);
                this.goalPos = this.country.getPosition();
                this.alpha += 10;
                if (this.alpha > 100) {
                    this.state = "MOVE";
                    this.alpha = 100;
                }


                break;
            case "MOVE":

                this.velocity.add(this.acceleration);
                this.velocity.limit(this.maxspeed);
                this.position.add(this.velocity);
                this.acceleration.mult(0);
                this.goalPos = this.country.getPosition();
                if (this.position.dist(this.goalPos) < 25) {
                    this.state = "VANISH";
                    this.country.addVelocity();
                } else if (this.position.dist(this.goalPos) < 10) {
                    this.state = "REMOVE";
                    this.country.addVelocity();
                }

                break;
            case "VANISH":

                this.velocity.add(this.acceleration);
                this.velocity.limit(this.maxspeed);
                this.position.add(this.velocity);
                this.acceleration.mult(0);
                this.goalPos = this.country.getPosition();
                this.alpha -= 5;

                if (this.alpha < 0) {
                    this.state = "REMOVE";
                }

                break;

            case "STOP":
                // console.log("stop")
                break;

            default:
                break;
        }


    }


    ////////////////////////////////
    applyForce(force) {
        this.acceleration.add(force);


    }
    ///////////////////////////////
    display() {



        //DRAW COUNTRY
        if (this.state == "MOVE" || this.state == "VANISH") {

            this.theta = this.velocity.heading() + PI / 2;
            let { r, g, b } = this.colorPallete.lightBlue;
            fill(r, g, b, this.alpha);
            noStroke()
            push();
            translate(this.position.x, this.position.y);
            // circle(0, 0, this.size);
            rotate(this.theta);
            beginShape();
            vertex(0, -this.r); // Arrow pointing upp
            vertex(-this.r, this.r); // Lower left corner
            vertex(this.r, this.r); // Lower right corner
            endShape(CLOSE);
            pop();
        }

    }
}