// Silence React's "The current testing environment is not configured to support act(...)"
// warning by opting in at setup time. See:
// https://react.dev/reference/react/act#is_react_act_environment
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
