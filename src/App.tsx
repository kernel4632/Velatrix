import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { NebulaScene as Scene1 } from "./ParticleSystem1";
import { NebulaScene as Scene2 } from "./ParticleSystem2";
import { NebulaScene as Scene3 } from "./ParticleSystem3";
import { NebulaScene as Scene4 } from "./ParticleSystem4";
import { NebulaScene as Scene5 } from "./ParticleSystem5";
import { NebulaScene as Scene6 } from "./ParticleSystem6";

const scenes = [
	{ component: Scene1, name: "星云 I" },
	{ component: Scene2, name: "星云 II" },
	{ component: Scene3, name: "星云 III" },
	{ component: Scene4, name: "星云 IV" },
	{ component: Scene5, name: "星云 V", hasAdvanced: true },
	{ component: Scene6, name: "星云 VI", hasAdvanced: true },
];

function App() {
	const [activeIndex, setActiveIndex] = useState(0);
	const ActiveScene = scenes[activeIndex].component;
	const [distance, setDistance] = useState(8);
	const [pinchL, setPinchL] = useState(100);
	const [pinchR, setPinchR] = useState(100);
	const [showControls, setShowControls] = useState(false);
	const [handUL, setHandUL] = useState(0);
	const [handUR, setHandUR] = useState(0);
	const [handLL, setHandLL] = useState(0);
	const [handLR, setHandLR] = useState(0);

	const isAdvanced = scenes[activeIndex].hasAdvanced;

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				width: "100vw",
				height: "100vh",
				overflow: "hidden",
				background: "#010103",
			}}>
			<Canvas camera={{ position: [0, 0, 20], fov: 45 }} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}>
				<color attach="background" args={["#010103"]} />
				<ActiveScene distance={distance} pinchL={pinchL} pinchR={pinchR} handUL={handUL} handUR={handUR} handLL={handLL} handLR={handLR} />
				<EffectComposer>
					<Bloom luminanceThreshold={0.1} luminanceSmoothing={0.8} intensity={4.0} mipmapBlur={true} />
				</EffectComposer>
			</Canvas>

			<div
				style={{
					position: "fixed",
					bottom: 20,
					left: "50%",
					transform: "translateX(-50%)",
					display: "flex",
					gap: 8,
					zIndex: 100,
				}}>
				{scenes.map((scene, index) => (
					<button
						key={index}
						onClick={() => setActiveIndex(index)}
						style={{
							padding: "8px 16px",
							borderRadius: 20,
							fontSize: 11,
							fontFamily: "monospace",
							letterSpacing: "0.1em",
							textTransform: "uppercase",
							border: activeIndex === index ? "1px solid rgba(255,255,255,0.4)" : "1px solid rgba(255,255,255,0.1)",
							background: activeIndex === index ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.4)",
							color: activeIndex === index ? "#fff" : "rgba(255,255,255,0.6)",
							cursor: "pointer",
							transition: "all 0.2s",
						}}>
						{scene.name}
					</button>
				))}
			</div>

			<button
				onClick={() => setShowControls(!showControls)}
				style={{
					position: "fixed",
					top: 16,
					right: 16,
					padding: "8px 12px",
					borderRadius: 8,
					fontSize: 10,
					fontFamily: "monospace",
					border: "1px solid rgba(255,255,255,0.1)",
					background: "rgba(0,0,0,0.4)",
					color: "rgba(255,255,255,0.6)",
					cursor: "pointer",
					zIndex: 100,
				}}>
				{showControls ? "隐藏控制" : "显示控制"}
			</button>

			{showControls && (
				<div
					style={{
						position: "fixed",
						top: 16,
						left: 16,
						padding: 16,
						borderRadius: 16,
						background: "rgba(0,0,0,0.6)",
						border: "1px solid rgba(255,255,255,0.1)",
						zIndex: 100,
						maxWidth: 320,
					}}>
					<div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
						<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
							<span style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontFamily: "monospace" }}>距离</span>
							<span style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, fontFamily: "monospace" }}>{distance.toFixed(1)}</span>
						</div>
						<input type="range" min={0} max={15} step={0.1} value={distance} onChange={(e) => setDistance(parseFloat(e.target.value))} style={{ width: "100%" }} />
					</div>

					<div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
						<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
							<span style={{ color: "rgba(100,200,255,0.8)", fontSize: 10, fontFamily: "monospace" }}>左捏合</span>
							<span style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, fontFamily: "monospace" }}>{pinchL}%</span>
						</div>
						<input type="range" min={0} max={100} value={pinchL} onChange={(e) => setPinchL(parseInt(e.target.value))} style={{ width: "100%" }} />
					</div>

					<div style={{ marginBottom: isAdvanced ? 16 : 0, paddingBottom: isAdvanced ? 12 : 0, borderBottom: isAdvanced ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
						<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
							<span style={{ color: "rgba(255,100,100,0.8)", fontSize: 10, fontFamily: "monospace" }}>右捏合</span>
							<span style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, fontFamily: "monospace" }}>{pinchR}%</span>
						</div>
						<input type="range" min={0} max={100} value={pinchR} onChange={(e) => setPinchR(parseInt(e.target.value))} style={{ width: "100%" }} />
					</div>

					{isAdvanced && (
						<div style={{ marginTop: 12 }}>
							<div style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, fontFamily: "monospace", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>
								高级方向控制
							</div>

							<div style={{ marginBottom: 8 }}>
								<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
									<span style={{ color: "rgba(255,200,100,0.7)", fontSize: 9, fontFamily: "monospace" }}>左上 (handUL)</span>
									<span style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, fontFamily: "monospace" }}>{handUL}%</span>
								</div>
								<input type="range" min={-100} max={100} value={handUL} onChange={(e) => setHandUL(parseInt(e.target.value))} style={{ width: "100%" }} />
							</div>

							<div style={{ marginBottom: 8 }}>
								<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
									<span style={{ color: "rgba(255,150,100,0.7)", fontSize: 9, fontFamily: "monospace" }}>右上 (handUR)</span>
									<span style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, fontFamily: "monospace" }}>{handUR}%</span>
								</div>
								<input type="range" min={-100} max={100} value={handUR} onChange={(e) => setHandUR(parseInt(e.target.value))} style={{ width: "100%" }} />
							</div>

							<div style={{ marginBottom: 8 }}>
								<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
									<span style={{ color: "rgba(100,200,255,0.7)", fontSize: 9, fontFamily: "monospace" }}>左下 (handLL)</span>
									<span style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, fontFamily: "monospace" }}>{handLL}%</span>
								</div>
								<input type="range" min={-100} max={100} value={handLL} onChange={(e) => setHandLL(parseInt(e.target.value))} style={{ width: "100%" }} />
							</div>

							<div>
								<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
									<span style={{ color: "rgba(150,100,255,0.7)", fontSize: 9, fontFamily: "monospace" }}>右下 (handLR)</span>
									<span style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, fontFamily: "monospace" }}>{handLR}%</span>
								</div>
								<input type="range" min={-100} max={100} value={handLR} onChange={(e) => setHandLR(parseInt(e.target.value))} style={{ width: "100%" }} />
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

export default App;
