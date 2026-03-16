import { BiAlarm } from 'react-icons/bi';
import { ArrowBigDown } from 'lucide-react';
import { SunIcon } from '@radix-ui/react-icons';
import { BellIcon } from '@heroicons/react/24/outline';
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
import { HugeiconsIcon } from '@hugeicons/react';
import { Alert02Icon } from '@hugeicons/core-free-icons';
import AlarmMui from '@mui/icons-material/Alarm';
import { Add as CarbonAdd } from '@carbon/icons-react';

const App = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center' }}>React Icons Sprite - Vite Demo</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '20px',
        }}
      >
        <section
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '14px', marginBottom: '10px' }}>
            react-icons/bi
          </h2>
          <BiAlarm />
        </section>

        <section
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '14px', marginBottom: '10px' }}>
            lucide-react
          </h2>
          <ArrowBigDown />
        </section>

        <section
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '14px', marginBottom: '10px' }}>
            @radix-ui/react-icons
          </h2>
          <SunIcon
            width={32}
            height={32}
          />
        </section>

        <section
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '14px', marginBottom: '10px' }}>
            @heroicons/react
          </h2>
          <BellIcon
            width={32}
            height={32}
          />
        </section>

        <section
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '14px', marginBottom: '10px' }}>
            @tabler/icons-react
          </h2>
          <IconAlertCircle />
        </section>

        <section
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '14px', marginBottom: '10px' }}>
            phosphor-react
          </h2>
          <Alarm />
        </section>

        <section
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '14px', marginBottom: '10px' }}>
            @phosphor-icons/react
          </h2>
          <AcornIcon />
        </section>

        <section
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '14px', marginBottom: '10px' }}>
            react-feather
          </h2>
          <Bell />
        </section>

        <section
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '14px', marginBottom: '10px' }}>
            react-bootstrap-icons
          </h2>
          <BootstrapAlarm />
        </section>

        <section
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '14px', marginBottom: '10px' }}>
            grommet-icons
          </h2>
          <Add />
        </section>

        <section
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '14px', marginBottom: '10px' }}>
            remixicon-react
          </h2>
          <RiAlarmFill />
        </section>

        <section
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '14px', marginBottom: '10px' }}>
            @remixicon/react
          </h2>
          <RiAlarmFill />
        </section>

        <section
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '14px', marginBottom: '10px' }}>
            devicons-react
          </h2>
          <BehancePlain />
        </section>

        <section
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '14px', marginBottom: '10px' }}>
            @fortawesome/react-fontawesome
          </h2>
          <FontAwesomeIcon icon={faCoffee} />
        </section>

        <section
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '14px', marginBottom: '10px' }}>
            @hugeicons/react
          </h2>
          <HugeiconsIcon icon={Alert02Icon} />
        </section>

        <section
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '14px', marginBottom: '10px' }}>
            @mui/icons-material
          </h2>
          <AlarmMui />
        </section>

        <section
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '14px', marginBottom: '10px' }}>
            @carbon/icons-react
          </h2>
          <CarbonAdd />
        </section>
      </div>
    </div>
  );
};

export default App;
