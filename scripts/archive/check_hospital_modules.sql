select name, state, latest_version, application
from ir_module_module
where name like 'hospital%'
order by name;
