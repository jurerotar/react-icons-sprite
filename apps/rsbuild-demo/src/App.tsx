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
import AlarmMui from '@mui/icons-material/Alarm';
import { Add as CarbonAdd } from '@carbon/icons-react';

const App = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center' }}>React Icons Sprite - Rsbuild Demo</h1>

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
          <BiAlarm
            size={32}
            color="red"
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
            lucide-react
          </h2>
          <ArrowBigDown
            size={32}
            color="blue"
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
          <IconAlertCircle size={32} />
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
          <Alarm size={32} />
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
          <AcornIcon size={32} />
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
          <Bell size={32} />
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
          <BootstrapAlarm size={32} />
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
          <Add size="32px" />
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
          <RiAlarmFill size={32} />
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
          <RiAlarmFill size={32} />
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
          <BehancePlain size={32} />
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
          <FontAwesomeIcon
            icon={faCoffee}
            size="2x"
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
            @mui/icons-material
          </h2>
          <AlarmMui fontSize="large" />
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
          <CarbonAdd size={32} />
        </section>
      </div>
    </div>
  );
};

export default App;
