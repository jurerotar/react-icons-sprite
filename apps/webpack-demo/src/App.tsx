import { BiAlarm } from 'react-icons/bi';
import { ArrowBigDown } from 'lucide-react';
import { SunIcon } from '@radix-ui/react-icons';
import { BellIcon } from '@heroicons/react/24/outline';
import HeroiconBellDefault from '@heroicons/react/24/outline/BellIcon';
import { IconAlertCircle } from '@tabler/icons-react';
import { Alarm } from 'phosphor-react';
import { AcornIcon } from '@phosphor-icons/react';
import { Bell } from 'react-feather';
import { Alarm as BootstrapAlarm } from 'react-bootstrap-icons';
import { Add } from 'grommet-icons';
import { RiAlarmFill } from '@remixicon/react';
import { BehancePlain } from 'devicons-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCoffee } from '@fortawesome/free-solid-svg-icons';
import AlarmMui from '@mui/icons-material/Alarm';
import { Alarm as AlarmMuiNamed } from '@mui/icons-material';
import { Add as CarbonAdd } from '@carbon/icons-react';

const App = () => {
  return (
    <div className="app">
      <h1 className="app-title">React Icons Sprite - Webpack Demo</h1>

      <div className="icon-grid">
        <section className="icon-card">
          <h2 className="icon-title">react-icons/bi</h2>
          <BiAlarm size={32} />
        </section>

        <section className="icon-card">
          <h2 className="icon-title">lucide-react</h2>
          <ArrowBigDown size={32} />
        </section>

        <section className="icon-card">
          <h2 className="icon-title">@radix-ui/react-icons</h2>
          <SunIcon
            width={32}
            height={32}
          />
        </section>

        <section className="icon-card">
          <h2 className="icon-title">@heroicons/react</h2>
          <BellIcon
            width={32}
            height={32}
          />
        </section>

        <section className="icon-card">
          <h2 className="icon-title">
            @heroicons/react (default subpath import)
          </h2>
          <HeroiconBellDefault
            width={32}
            height={32}
          />
        </section>

        <section className="icon-card">
          <h2 className="icon-title">@tabler/icons-react</h2>
          <IconAlertCircle size={32} />
        </section>

        <section className="icon-card">
          <h2 className="icon-title">phosphor-react</h2>
          <Alarm size={32} />
        </section>

        <section className="icon-card">
          <h2 className="icon-title">@phosphor-icons/react</h2>
          <AcornIcon size={32} />
        </section>

        <section className="icon-card">
          <h2 className="icon-title">react-feather</h2>
          <Bell size={32} />
        </section>

        <section className="icon-card">
          <h2 className="icon-title">react-bootstrap-icons</h2>
          <BootstrapAlarm size={32} />
        </section>

        <section className="icon-card">
          <h2 className="icon-title">grommet-icons</h2>
          <Add size="32px" />
        </section>

        <section className="icon-card">
          <h2 className="icon-title">remixicon-react</h2>
          <RiAlarmFill size={32} />
        </section>

        <section className="icon-card">
          <h2 className="icon-title">@remixicon/react</h2>
          <RiAlarmFill size={32} />
        </section>

        <section className="icon-card">
          <h2 className="icon-title">devicons-react</h2>
          <BehancePlain size={32} />
        </section>

        <section className="icon-card">
          <h2 className="icon-title">@fortawesome/react-fontawesome</h2>
          <FontAwesomeIcon
            icon={faCoffee}
            size="2x"
          />
        </section>

        <section className="icon-card">
          <h2 className="icon-title">@mui/icons-material</h2>
          <AlarmMui fontSize="large" />
        </section>

        <section className="icon-card">
          <h2 className="icon-title">
            @mui/icons-material (named root import)
          </h2>
          <AlarmMuiNamed fontSize="large" />
        </section>

        <section className="icon-card">
          <h2 className="icon-title">@carbon/icons-react</h2>
          <CarbonAdd size={32} />
        </section>
      </div>

      <style>{`
        .app {
          padding: 20px;
          font-family: sans-serif;
        }

        .app-title {
          text-align: center;
        }

        .icon-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 20px;
        }

        .icon-card {
          border: 1px solid #ccc;
          border-radius: 8px;
          padding: 16px;
          text-align: center;
        }

        .icon-title {
          font-size: 14px;
          margin-bottom: 10px;
        }
      `}</style>
    </div>
  );
};

export default App;
