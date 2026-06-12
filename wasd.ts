declare const Il2Cpp: any;
declare const console: any;

Il2Cpp.perform(() => {

    const AC       = Il2Cpp.domain.assembly("AnimalCompany").image;
    const Core     = Il2Cpp.domain.assembly("UnityEngine.CoreModule").image;
    const InputSys = Il2Cpp.domain.assembly("Unity.InputSystem").image;

    const GTPlayerClass = AC.class("AnimalCompany.GorillaLocomotion");
    const PCClass       = AC.class("AnimalCompany.PlayerController");
    const Vector3       = Core.class("UnityEngine.Vector3");
    const Quaternion    = Core.class("UnityEngine.Quaternion");
    const Time          = Core.class("UnityEngine.Time");
    const Keyboard      = InputSys.class("UnityEngine.InputSystem.Keyboard");
    const Mouse         = InputSys.class("UnityEngine.InputSystem.Mouse");

    const instance     = GTPlayerClass.fields.find((f: any) => f.name.includes("Instance"))?.value;
    const headCollider = instance.field("headCollider").value;

    let flyEnabled  = false;
    let camYaw      = 0.0;
    let camPitch    = 0.0;
    let deltaTime   = 0.0;
    let sensitivity = 0.15;
    let flySpeed    = 1.0;

    console.log("[wasd fly] script loaded, setting up hooks...");

    function getKb() {
        try {
            const kb = Keyboard.field("<current>k__BackingField").value;
            return (!kb || kb.isNull()) ? null : kb;
        } catch(e) { console.log("[wasd fly] getKb error: " + e); return null; }
    }

    function getMouse() {
        try {
            const m = Mouse.field("<current>k__BackingField").value;
            return (!m || m.isNull()) ? null : m;
        } catch(e) { console.log("[wasd fly] getMouse error: " + e); return null; }
    }

    function keyDown(getter: string): boolean {
        try {
            const kb = getKb();
            if (!kb) return false;
            return kb.method(getter).invoke().method("get_isPressed").invoke();
        } catch { return false; }
    }

    function keyTapped(getter: string): boolean {
        try {
            const kb = getKb();
            if (!kb) return false;
            return kb.method(getter).invoke().method("get_wasPressedThisFrame").invoke();
        } catch { return false; }
    }

    function mouseDelta(): [number, number] {
        try {
            const m = getMouse();
            if (!m) return [0, 0];
            const delta = m.method("get_delta").invoke();
            const x = delta.method("get_x").invoke().method("ReadValue").invoke() as number;
            const y = delta.method("get_y").invoke().method("ReadValue").invoke() as number;
            return [x, y];
        } catch(e) { console.log("[wasd fly] mouseDelta error: " + e); return [0, 0]; }
    }

    function addForce(dir: any) {
        try {
            const pc = PCClass.method("get_instance").invoke();
            if (!pc || pc.isNull()) {
                console.log("[wasd fly] PlayerController instance is null");
                return;
            }
            const force = Vector3.method("op_Multiply", 2).invoke(dir, flySpeed);
            pc.method("AddExternalForceVelocity").invoke(force, true);
        } catch(e) { console.log("[wasd fly] addForce error: " + e); }
    }

    function getHeadTransform() {
        try {
            return headCollider.method("get_transform").invoke();
        } catch(e) { console.log("[wasd fly] getHeadTransform error: " + e); return null; }
    }

    function normalize(v: number[]): number[] {
        const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
        if (len < 0.001) return [0, 0, 0];
        return [v[0]/len, v[1]/len, v[2]/len];
    }

    function add(a: number[], b: number[]): number[] {
        return [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
    }

    function neg(v: number[]): number[] {
        return [-v[0], -v[1], -v[2]];
    }

    // forward direction from yaw+pitch
    function camForward(): number[] {
        const yr = camYaw   * (Math.PI / 180);
        const pr = camPitch * (Math.PI / 180);
        return [
            Math.cos(pr) * Math.sin(yr),
            -Math.sin(pr),
            Math.cos(pr) * Math.cos(yr),
        ];
    }

    function camRight(): number[] {
        const yr = camYaw * (Math.PI / 180);
        return [Math.cos(yr), 0, -Math.sin(yr)];
    }

// tiki tiki hook
    const LateUpdate = GTPlayerClass.method("OnLateUpdate");
    console.log("[wasd fly] hooking OnLateUpdate...");

    LateUpdate.implementation = function() {
        try {
            deltaTime = Time.method("get_deltaTime").invoke();

            // when press f = enable fly = disable anticheat
            if (keyTapped("get_fKey")) {
                flyEnabled = !flyEnabled;
                console.log("[wasd fly] fly " + (flyEnabled ? "ON — wasd to move, right click drag to look" : "OFF"));
            }

            if (flyEnabled) {
                const m = getMouse();
                const rightHeld = m
                    ? m.method("get_rightButton").invoke().method("get_isPressed").invoke()
                    : false;

                // mouse look while right click held
                if (rightHeld) {
                    const [dx, dy] = mouseDelta();
                    camYaw   += dx * sensitivity;
                    camPitch -= dy * sensitivity;
                    camPitch  = Math.max(-89, Math.min(89, camPitch));

                    const ht = getHeadTransform();
                    if (ht) {
                        const rot = Quaternion.method("Euler").invoke(camPitch, camYaw, 0);
                        ht.method("set_rotation").invoke(rot);
                    }
                }

                // wasd movement relative to camera angle
                const w     = keyDown("get_wKey");
                const s     = keyDown("get_sKey");
                const a     = keyDown("get_aKey");
                const d     = keyDown("get_dKey");
                const space = keyDown("get_spaceKey");
                const shift = keyDown("get_leftShiftKey");

                if (w || s || a || d || space || shift) {
                    const fwd   = camForward();
                    const right = camRight();

                    let dir: number[] = [0, 0, 0];
                    if (w)     dir = add(dir, fwd);
                    if (s)     dir = add(dir, neg(fwd));
                    if (d)     dir = add(dir, right);
                    if (a)     dir = add(dir, neg(right));
                    if (space) dir = add(dir, [0, 1, 0]);
                    if (shift) dir = add(dir, [0, -1, 0]);

                    const norm = normalize(dir);
                    if (norm[0] !== 0 || norm[1] !== 0 || norm[2] !== 0) {
                        addForce(norm);
                    }
                }
            }
        } catch(e) {
            console.log("[wasd fly] LateUpdate error: " + e);
        }

        return this.method("OnLateUpdate").invoke();
    };

    console.log("[wasd fly] ready — press F in-game to toggle");

}, "main");