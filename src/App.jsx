import GameScene from './game/GameScene'
import AuthHUD from './ui/AuthHUD'
import Controls from './ui/Controls'
import FpsCounter from './ui/FpsCounter'
import GameHUD from './ui/GameHUD'
import LoadingScreen from './ui/LoadingScreen'
import SoundToggle from './ui/SoundToggle'

function App() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-900">
      <GameScene />
      <AuthHUD />
      <GameHUD />
      <Controls />
      <SoundToggle />
      <FpsCounter />
      <LoadingScreen />
    </div>
  )
}

export default App
