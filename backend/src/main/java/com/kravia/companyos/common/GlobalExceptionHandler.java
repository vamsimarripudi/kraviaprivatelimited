package com.kravia.companyos.common;

import jakarta.validation.ConstraintViolationException;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(NotFoundException.class)
    ResponseEntity<ApiError> notFound(NotFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError("NOT_FOUND", exception.getMessage(), null));
    }

    @ExceptionHandler({ForbiddenOperationException.class, AccessDeniedException.class})
    ResponseEntity<ApiError> forbidden(RuntimeException exception) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ApiError("FORBIDDEN", exception.getMessage(), null));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> validation(MethodArgumentNotValidException exception) {
        Map<String, String> details = exception.getBindingResult().getFieldErrors().stream()
            .collect(Collectors.toMap(error -> error.getField(), error -> error.getDefaultMessage(), (left, right) -> left));
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_FAILED", "Request validation failed.", details));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ApiError> constraint(ConstraintViolationException exception) {
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_FAILED", exception.getMessage(), null));
    }

    @ExceptionHandler({MissingServletRequestParameterException.class, MissingServletRequestPartException.class})
    ResponseEntity<ApiError> missingRequestValue(Exception exception) {
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_FAILED", "A required request value is missing.", null));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiError> typeMismatch(MethodArgumentTypeMismatchException exception) {
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_FAILED", "Request contains an invalid value.", null));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> unreadable(HttpMessageNotReadableException exception) {
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_FAILED", "Request body contains an invalid value.", null));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ApiError> uploadTooLarge(MaxUploadSizeExceededException exception) {
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_FAILED", "Document file exceeds the configured size limit.", null));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ApiError> illegalArgument(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(new ApiError("BAD_REQUEST", exception.getMessage(), null));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> general(Exception exception) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ApiError("INTERNAL_ERROR", "Internal server error.", null));
    }
}
