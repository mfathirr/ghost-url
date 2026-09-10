import { useLocale } from '../context/LocaleContext';

export const useTranslation = () => {
  const { t, locale, setLocale, locales, currentLocaleMeta } = useLocale();

  return {
    t,
    locale,
    setLocale,
    locales,
    currentLocaleMeta,
  };
};

export default useTranslation;
