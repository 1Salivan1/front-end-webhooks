import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { isApiError, isValidationError } from '../../api/errors'
import { useAuth } from '../../auth/useAuth'
import { applyServerErrors } from '../../lib/applyServerErrors'

const schema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
})

type LoginForm = z.infer<typeof schema>

interface LocationState {
  from?: { pathname: string; search: string }
}

export function LoginPage() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const state = location.state as LocationState | null
  const redirectTo = state?.from ? `${state.from.pathname}${state.from.search}` : '/webhooks'

  if (user !== null) {
    return <Navigate to={redirectTo} replace />
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await signIn(values)
      await navigate(redirectTo, { replace: true })
    } catch (error) {
      if (isValidationError(error)) {
        applyServerErrors(error.payload, ['email', 'password'], setError)
        return
      }
      setError('root', {
        message: isApiError(error) ? error.message : 'Unable to sign in. Please try again.',
      })
    }
  })

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent>
          <Typography variant="h5" component="h1" gutterBottom>
            Sign in
          </Typography>

          <form onSubmit={onSubmit} noValidate>
            <Stack spacing={2}>
              {errors.root?.message !== undefined && (
                <Alert severity="error">{errors.root.message}</Alert>
              )}

              <TextField
                label="Email"
                type="email"
                autoComplete="username"
                autoFocus
                error={errors.email !== undefined}
                helperText={errors.email?.message ?? ' '}
                {...register('email')}
              />

              <TextField
                label="Password"
                type="password"
                autoComplete="current-password"
                error={errors.password !== undefined}
                helperText={errors.password?.message ?? ' '}
                {...register('password')}
              />

              <Button type="submit" variant="contained" size="large" loading={isSubmitting}>
                Sign in
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  )
}
