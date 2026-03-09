import { BiAlarm } from 'react-icons/bi';
import { Circle } from 'lucide-react';
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

const App = () => {
  return (
    <div>
      <h1>React Icons Sprite - Demo</h1>

      <section>
        <h2>react-icons/bi</h2>
        <BiAlarm
          size={32}
          color="red"
        />
      </section>

      <section>
        <h2>lucide-react</h2>
        <Circle
          size={32}
          color="blue"
        />
      </section>

      <section>
        <h2>@radix-ui/react-icons</h2>
        <SunIcon
          width={32}
          height={32}
        />
      </section>

      <section>
        <h2>@heroicons/react</h2>
        <BellIcon
          width={32}
          height={32}
        />
      </section>

      <section>
        <h2>@tabler/icons-react</h2>
        <IconAlertCircle size={32} />
      </section>

      <section>
        <h2>phosphor-react</h2>
        <Alarm size={32} />
      </section>

      <section>
        <h2>@phosphor-icons/react</h2>
        <AcornIcon size={32} />
      </section>

      <section>
        <h2>react-feather</h2>
        <Bell size={32} />
      </section>

      <section>
        <h2>react-bootstrap-icons</h2>
        <BootstrapAlarm size={32} />
      </section>

      <section>
        <h2>grommet-icons</h2>
        <Add size={32} />
      </section>

      <section>
        <h2>remixicon-react</h2>
        <AcornIcon size={32} />
      </section>

      <section>
        <h2>@remixicon/react</h2>
        <RiAlarmFill size={32} />
      </section>

      <section>
        <h2>devicons-react</h2>
        <BehancePlain size={32} />
      </section>

      <section>
        <h2>@fortawesome/react-fontawesome</h2>
        <FontAwesomeIcon
          icon={faCoffee}
          size="2x"
        />
      </section>

      <section>
        <h2>@mui/icons-material</h2>
        <AlarmMui fontSize="large" />
      </section>
    </div>
  );
};

export default App;
