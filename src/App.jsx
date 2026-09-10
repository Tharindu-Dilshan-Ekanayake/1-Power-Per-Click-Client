import GameScene from './game/GameScene'
import AuthHUD from './ui/AuthHUD'
import Controls from './ui/Controls'
import GameHUD from './ui/GameHUD'

function App() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-900">
      <GameScene />
      <AuthHUD />
      <GameHUD />
      <Controls />
    </div>
  )
}

export default App
