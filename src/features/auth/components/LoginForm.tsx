import { Controller } from 'react-hook-form'
import { Button } from '#/components/Button'
import { Checkbox } from '#/components/Checkbox'
import { PasswordField } from '#/components/PasswordField'
import { TextField } from '#/components/TextField'
import { useOnline } from '#/hooks/useOnline'
import { useLogin } from '../hooks/useLogin'
import { FormError } from './FormError'

export function LoginForm() {
  const { form, submit, formError } = useLogin()
  const online = useOnline()
  const {
    register,
    control,
    formState: { errors, isSubmitting },
  } = form

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-[15px]">
      {formError ? <FormError message={formError} /> : null}

      <TextField
        label="Email address"
        id="login-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register('email')}
      />

      <PasswordField
        label="Password"
        id="login-password"
        autoComplete="current-password"
        placeholder="••••••••••"
        error={errors.password?.message}
        headerAction={
          <button
            type="button"
            className="cursor-pointer border-none bg-transparent p-0 text-[12.5px] font-semibold text-fp-accent-ink hover:underline"
          >
            Forgot?
          </button>
        }
        {...register('password')}
      />

      <Controller
        control={control}
        name="rememberMe"
        render={({ field }) => (
          <Checkbox
            checked={field.value}
            onCheckedChange={field.onChange}
            onBlur={field.onBlur}
          >
            Keep me signed in on this device
          </Checkbox>
        )}
      />

      <Button
        type="submit"
        disabled={isSubmitting || !online}
        className="mt-0.5"
      >
        {isSubmitting ? 'Logging in…' : 'Log in'}
      </Button>
    </form>
  )
}
